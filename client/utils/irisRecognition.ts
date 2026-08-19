import * as faceapi from 'face-api.js';

export interface IrisRecognitionResult {
  emotion: string;
  focusScore: number;
  gazeDirection: string;
  timestamp: number;
}

export class IrisRecognitionService {
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private isRunning: boolean = false;
  private onResultCallback: ((result: IrisRecognitionResult) => void) | null = null;
  private intervalId: NodeJS.Timeout | null = null;

  async loadModels(): Promise<void> {
    const MODEL_URL = '/models';
    
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ]);
    
    console.log('Iris recognition models loaded');
  }

  async startVideo(
    videoElement: HTMLVideoElement,
    onResult: (result: IrisRecognitionResult) => void
  ): Promise<void> {
    this.videoElement = videoElement;
    this.onResultCallback = onResult;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      videoElement.srcObject = stream;
      
      await new Promise<void>((resolve) => {
        videoElement.onloadedmetadata = () => {
          videoElement.play();
          resolve();
        };
      });

      this.isRunning = true;
      this.startAnalysis();
    } catch (error) {
      console.error('Failed to start video:', error);
      throw error;
    }
  }

  private startAnalysis(): void {
    this.intervalId = setInterval(async () => {
      if (!this.isRunning || !this.videoElement) return;

      try {
        const detections = await faceapi
          .detectAllFaces(this.videoElement, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceExpressions();

        if (detections.length > 0) {
          const detection = detections[0];
          const expressions = detection.expressions;
          
          // 获取主要表情
          const mainEmotion = Object.entries(expressions).reduce((a, b) => 
            a[1] > b[1] ? a : b
          )[0];

          // 计算专注度分数（基于中性表情和眼睛睁开程度）
          const neutralScore = expressions.neutral || 0;
          const focusScore = Math.min(100, neutralScore * 100 + 20);

          // 估算视线方向（基于面部特征点）
          const landmarks = detection.landmarks;
          const leftEye = landmarks.getLeftEye();
          const rightEye = landmarks.getRightEye();
          const gazeDirection = this.estimateGazeDirection(leftEye, rightEye);

          const result: IrisRecognitionResult = {
            emotion: mainEmotion,
            focusScore: Math.round(focusScore),
            gazeDirection,
            timestamp: Date.now(),
          };

          this.onResultCallback?.(result);
        }
      } catch (error) {
        console.error('Analysis error:', error);
      }
    }, 2000); // 每 2 秒分析一次
  }

  private estimateGazeDirection(
    leftEye: faceapi.Point[],
    rightEye: faceapi.Point[]
  ): string {
    const leftCenter = this.getCenter(leftEye);
    const rightCenter = this.getCenter(rightEye);
    const midX = (leftCenter.x + rightCenter.x) / 2;
    const midY = (leftCenter.y + rightCenter.y) / 2;

    // 简单的视线方向估算
    if (midY < 150) return 'up';
    if (midY > 250) return 'down';
    if (midX < 150) return 'left';
    if (midX > 250) return 'right';
    return 'center';
  }

  private getCenter(points: faceapi.Point[]): { x: number; y: number } {
    const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    return { x, y };
  }

  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.videoElement?.srcObject) {
      const stream = this.videoElement.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      this.videoElement.srcObject = null;
    }
  }
}

export const irisRecognitionService = new IrisRecognitionService();
