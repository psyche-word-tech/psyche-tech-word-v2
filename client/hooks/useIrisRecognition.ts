import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchWithRetry } from '@/utils/apiClient';
import { getApiBaseUrl } from '@/utils/apiConfig';

interface IrisData {
  focusScore: number;
  emotion: string;
  gazeDirection: string;
}

interface UseIrisRecognitionOptions {
  enabled: boolean;
  intervalMs?: number;
}

const MODEL_URL = '/models';

export function useIrisRecognition({ enabled, intervalMs = 30000 }: UseIrisRecognitionOptions) {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [irisEnabled, setIrisEnabled] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [latestData, setLatestData] = useState<IrisData | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceapiRef = useRef<any>(null);

  // 动态加载 Face-API.js（避免导入时崩溃）
  const loadFaceApi = useCallback(async () => {
    if (faceapiRef.current) return true;
    try {
      const faceapi = await import('face-api.js');
      faceapiRef.current = faceapi;
      return true;
    } catch (error) {
      console.error('[Iris] face-api.js 加载失败:', error);
      return false;
    }
  }, []);

  // 加载 Face-API.js 模型
  const loadModels = useCallback(async () => {
    if (modelsLoaded) return true;
    const faceapi = faceapiRef.current;
    if (!faceapi) return false;
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
      setModelsLoaded(true);
      console.log('[Iris] 模型加载成功');
      return true;
    } catch (error) {
      console.error('[Iris] 模型加载失败:', error);
      return false;
    }
  }, [modelsLoaded]);

  // 检查虹膜识别是否已开通
  const checkIrisStatus = useCallback(async () => {
    try {
      const response = await fetchWithRetry(`${getApiBaseUrl()}/api/iris/status`, {
        method: 'GET',
      });
      const data = await response.json();
      if (data.success) {
        setIrisEnabled(data.enabled || false);
        return data.enabled || false;
      }
      return false;
    } catch (error) {
      console.error('[Iris] 检查状态失败:', error);
      return false;
    }
  }, []);

  // 初始化摄像头
  const initCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' }
      });

      if (!videoRef.current) {
        videoRef.current = document.createElement('video');
        videoRef.current.style.display = 'none';
        document.body.appendChild(videoRef.current);
      }

      videoRef.current.srcObject = stream;
      videoRef.current.autoplay = true;
      videoRef.current.playsInline = true;

      // 等待视频流准备好
      await new Promise<void>((resolve) => {
        videoRef.current!.onloadedmetadata = () => {
          videoRef.current!.play();
          resolve();
        };
      });

      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
        canvasRef.current.width = 320;
        canvasRef.current.height = 240;
      }

      return true;
    } catch (error) {
      console.error('[Iris] 初始化摄像头失败:', error);
      return false;
    }
  }, []);

  // 停止摄像头
  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (videoRef.current && document.body.contains(videoRef.current)) {
      document.body.removeChild(videoRef.current);
      videoRef.current = null;
    }
  }, []);

  // 使用 Face-API.js 分析面部
  const analyzeFace = useCallback(async (): Promise<IrisData | null> => {
    if (!videoRef.current || !canvasRef.current) return null;
    const faceapi = faceapiRef.current;
    if (!faceapi) return null;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // 将视频帧绘制到 canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 检测面部、特征点和表情
      const detection = await faceapi
        .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceExpressions();

      if (!detection) {
        // 未检测到面部
        return {
          focusScore: 0,
          emotion: 'no_face',
          gazeDirection: 'unknown',
        };
      }

      // 计算专注度（基于面部是否在画面中心）
      const box = detection.detection.box;
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      const canvasCenterX = canvas.width / 2;
      const canvasCenterY = canvas.height / 2;

      const offsetX = Math.abs(centerX - canvasCenterX) / canvasCenterX;
      const offsetY = Math.abs(centerY - canvasCenterY) / canvasCenterY;
      const focusScore = Math.max(0, 1 - (offsetX + offsetY) / 2);

      // 获取主要情绪
      const expressions = detection.expressions;
      const emotionEntries = Object.entries(expressions) as [string, number][];
      emotionEntries.sort((a, b) => b[1] - a[1]);
      const mainEmotion = emotionEntries[0]?.[0] || 'neutral';

      // 估算视线方向（基于面部位置）
      let gazeDirection = 'center';
      if (offsetX > 0.3) {
        gazeDirection = centerX < canvasCenterX ? 'left' : 'right';
      } else if (offsetY > 0.3) {
        gazeDirection = centerY < canvasCenterY ? 'up' : 'down';
      }

      return {
        focusScore: Math.round(focusScore * 100) / 100,
        emotion: mainEmotion,
        gazeDirection,
      };
    } catch (error) {
      console.error('[Iris] 面部分析失败:', error);
      return null;
    }
  }, []);

  // 发送虹膜数据到服务器
  const sendIrisData = useCallback(async (data: IrisData) => {
    try {
      await fetchWithRetry(`${getApiBaseUrl()}/api/iris/iris-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focus_score: data.focusScore,
          emotion: data.emotion,
          gaze_direction: data.gazeDirection,
        }),
      });
      setLatestData(data);
      console.log('[Iris] 数据发送成功:', data);
    } catch (error) {
      console.error('[Iris] 发送数据失败:', error);
    }
  }, []);

  // 开始监测
  const startMonitoring = useCallback(async () => {
    if (!enabled || !irisEnabled) return;

    // 动态加载 face-api.js
    const faceapiLoaded = await loadFaceApi();
    if (!faceapiLoaded) {
      console.warn('[Iris] face-api.js 不可用，跳过监测');
      return;
    }

    // 加载模型
    const modelsReady = await loadModels();
    if (!modelsReady) return;

    // 初始化摄像头
    const cameraReady = await initCamera();
    if (!cameraReady) return;

    setIsMonitoring(true);

    // 立即采集一次
    const data = await analyzeFace();
    if (data) {
      await sendIrisData(data);
    }

    // 设置定时器
    intervalRef.current = setInterval(async () => {
      const data = await analyzeFace();
      if (data) {
        await sendIrisData(data);
      }
    }, intervalMs);
  }, [enabled, irisEnabled, loadFaceApi, loadModels, initCamera, analyzeFace, sendIrisData, intervalMs]);

  // 停止监测
  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    stopCamera();
    setIsMonitoring(false);
  }, [stopCamera]);

  // 初始化时检查状态
  useEffect(() => {
    checkIrisStatus();
  }, [checkIrisStatus]);

  // 清理
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  return {
    irisEnabled,
    isMonitoring,
    modelsLoaded,
    latestData,
    startMonitoring,
    stopMonitoring,
    checkIrisStatus,
  };
}
