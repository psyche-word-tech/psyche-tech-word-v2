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

export function useIrisRecognition({ enabled, intervalMs = 30000 }: UseIrisRecognitionOptions) {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [irisEnabled, setIrisEnabled] = useState(false);
  const [latestData, setLatestData] = useState<IrisData | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  // 分析面部（模拟数据，实际应使用 Face-API.js）
  const analyzeFace = useCallback((): IrisData => {
    // 模拟分析结果
    // 实际实现需要加载 Face-API.js 模型并分析视频帧
    const emotions = ['happy', 'neutral', 'focused', 'confused', 'tired'];
    const gazeDirections = ['center', 'left', 'right', 'up', 'down'];
    
    return {
      focusScore: Math.random() * 0.4 + 0.6, // 0.6 - 1.0
      emotion: emotions[Math.floor(Math.random() * emotions.length)],
      gazeDirection: gazeDirections[Math.floor(Math.random() * gazeDirections.length)],
    };
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
    } catch (error) {
      console.error('[Iris] 发送数据失败:', error);
    }
  }, []);

  // 开始监测
  const startMonitoring = useCallback(async () => {
    if (!enabled || !irisEnabled) return;
    
    const cameraReady = await initCamera();
    if (!cameraReady) return;
    
    setIsMonitoring(true);
    
    // 立即采集一次
    const data = analyzeFace();
    await sendIrisData(data);
    
    // 设置定时器
    intervalRef.current = setInterval(async () => {
      const data = analyzeFace();
      await sendIrisData(data);
    }, intervalMs);
  }, [enabled, irisEnabled, initCamera, analyzeFace, sendIrisData, intervalMs]);

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
    latestData,
    startMonitoring,
    stopMonitoring,
    checkIrisStatus,
  };
}
