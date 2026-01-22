import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Crosshair,
  Wifi,
  WifiOff,
  Maximize2,
  Minimize2,
  Target,
  Bug,
  Send,
  SwitchCamera,
  Settings,
  Smartphone,
  Loader2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { CameraManager, type CameraDevice } from '../../lib/cameraManager';
import type { DartTarget } from '../../lib/dartsEngine';
import {
  getActiveRemoteCameras,
  subscribeToRemoteCameras,
  RemoteCameraViewer,
  type RemoteCameraSession,
} from '../../lib/remoteCameraSharing';
import { useAuthStore } from '../../stores/authStore';
import {
  checkApiHealth,
  detectBoard,
  scoreThrow,
  setReferenceImage,
  parseScoreToTarget,
  captureVideoFrame,
  captureHighQualityFrame,
  getApiUrl,
  boardDetectToCalibration,
  type BoardDetectResult,
  type ThrowScoreResult,
  type AutoCalibrationResult,
} from '../../lib/dartDetectionApi';

interface CameraDetectionInputProps {
  onThrow: (target: DartTarget) => void;
  disabled?: boolean;
  remainingDarts?: number;
}

const BOARD_DETECT_INTERVAL = 1000;
const AUTO_SUBMIT_CONFIDENCE = 0.70;

export function CameraDetectionInput({
  onThrow,
  disabled = false,
  remainingDarts = 3,
}: CameraDetectionInputProps) {
  const { user } = useAuthStore();
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingScore, setPendingScore] = useState<ThrowScoreResult | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showCameraSettings, setShowCameraSettings] = useState(false);
  const [debugImages, setDebugImages] = useState<{
    canonical?: string;
    diff?: string;
    mask?: string;
  }>({});
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [remoteCameras, setRemoteCameras] = useState<RemoteCameraSession[]>([]);
  const [connectingRemoteId, setConnectingRemoteId] = useState<string | null>(null);
  const [activeRemoteCamera, setActiveRemoteCamera] = useState<string | null>(null);
  const [boardConfidence, setBoardConfidence] = useState<number>(0);
  const [autoDetectEnabled, setAutoDetectEnabled] = useState(false);
  const [showSectorOverlay, setShowSectorOverlay] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<CameraManager | null>(null);
  const boardDetectIntervalRef = useRef<number | null>(null);
  const referenceFrameRef = useRef<Blob | null>(null);
  const calibrationRef = useRef<AutoCalibrationResult | null>(null);
  const boardResultRef = useRef<BoardDetectResult | null>(null);
  const homographyRef = useRef<number[][] | null>(null);
  const remoteViewerRef = useRef<RemoteCameraViewer | null>(null);
  const pendingAfterFrameRef = useRef<Blob | null>(null);
  const autoDetectIntervalRef = useRef<number | null>(null);
  const throwCooldownRef = useRef<boolean>(false);

  useEffect(() => {
    if (!user) return;

    const loadRemoteCameras = async () => {
      try {
        const sessions = await getActiveRemoteCameras();
        const uniqueSessions = sessions.filter((session, index, self) =>
          index === self.findIndex(s => s.id === session.id)
        );
        setRemoteCameras(uniqueSessions);
      } catch (err) {
        console.error('[RemoteCamera] Failed to load sessions:', err);
      }
    };
    loadRemoteCameras();

    const pollInterval = setInterval(loadRemoteCameras, 5000);

    const channel = subscribeToRemoteCameras(user.id, (sessions) => {
      const uniqueSessions = sessions.filter((session, index, self) =>
        index === self.findIndex(s => s.id === session.id)
      );
      setRemoteCameras(uniqueSessions);
    });

    return () => {
      clearInterval(pollInterval);
      channel.unsubscribe();
    };
  }, [user]);

  const checkConnection = useCallback(async (showStatus = false) => {
    if (showStatus) {
      setStatusMessage('Csatlakozas a szerverhez...');
    }
    try {
      const health = await checkApiHealth(3);
      if (health) {
        setApiConnected(true);
        if (showStatus) {
          setStatusMessage('Szerver kapcsolat aktiv!');
          setTimeout(() => setStatusMessage(null), 2000);
        }
        return true;
      }
    } catch (err) {
      console.error('[Camera] Connection error:', err);
    }
    setApiConnected(false);
    if (showStatus) {
      setStatusMessage('Szerver nem elerheto - varj 1-2 percet (Render free tier)');
      setTimeout(() => setStatusMessage(null), 6000);
    }
    return false;
  }, []);

  useEffect(() => {
    checkConnection(true);
    const interval = setInterval(() => checkConnection(false), 30000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  const runBoardDetection = useCallback(async (forceCalibrate: boolean = false) => {
    if (!videoRef.current) return;

    try {
      setIsCalibrating(true);
      setStatusMessage('Tabla keresese...');
      const frameBlob = await captureVideoFrame(videoRef.current);
      const result = await detectBoard(frameBlob);

      if (result && result.board_found) {
        boardResultRef.current = result;
        homographyRef.current = result.homography;

        const cal = boardDetectToCalibration(result);
        calibrationRef.current = cal;
        setBoardConfidence(result.confidence);
        setApiConnected(true);

        if (!isCalibrated || forceCalibrate) {
          setIsCalibrated(true);
          referenceFrameRef.current = frameBlob;
          await setReferenceImage(frameBlob);
          setStatusMessage('Tabla kalibrálva!');
          setTimeout(() => setStatusMessage(null), 2000);
        } else {
          setStatusMessage(null);
        }

        if (result.canonical_preview) {
          setDebugImages(prev => ({ ...prev, canonical: result.canonical_preview! }));
        }
      } else {
        setStatusMessage('Tabla nem talalhato - mozgasd a kamerat');
        setBoardConfidence(0);
      }
    } catch (err) {
      console.error('[Camera] Board detection error:', err);
      setStatusMessage('Hiba a tabla kereseskor');
    } finally {
      setIsCalibrating(false);
    }
  }, [isCalibrated]);

  const recalibrate = useCallback(async () => {
    await runBoardDetection(true);
  }, [runBoardDetection]);

  const runInitialCalibration = useCallback(async () => {
    const attemptDetection = async (attemptsLeft: number) => {
      if (attemptsLeft <= 0) {
        setStatusMessage('Tabla nem talalhato - probalj jobb szogbol');
        return;
      }

      await runBoardDetection(true);

      if (!calibrationRef.current?.success) {
        setTimeout(() => attemptDetection(attemptsLeft - 1), 2000);
      }
    };

    attemptDetection(10);
  }, [runBoardDetection]);

  const startCamera = useCallback(async (deviceId?: string) => {
    if (!videoRef.current) return;

    setError(null);
    setIsConnecting(true);
    setStatusMessage('Kamera inditasa...');

    const camera = new CameraManager();
    if (deviceId) {
      camera.setDevice(deviceId);
    }
    cameraRef.current = camera;

    const success = await camera.start(videoRef.current);
    if (!success) {
      setError('Nem sikerult elinditani a kamerat.');
      setIsConnecting(false);
      setStatusMessage(null);
      return;
    }

    setIsActive(true);
    setIsConnecting(false);

    camera.listDevices().then(cameras => {
      setAvailableCameras(cameras);
      const currentDevice = cameras.find(c => c.deviceId === camera.getSettings().deviceId);
      if (currentDevice) {
        setCurrentCameraIndex(cameras.indexOf(currentDevice));
      }
    });

    await checkConnection(false);

    setTimeout(() => {
      runInitialCalibration();
    }, 500);
  }, [checkConnection, runInitialCalibration]);

  const stopCamera = useCallback(() => {
    if (boardDetectIntervalRef.current) {
      clearInterval(boardDetectIntervalRef.current);
      boardDetectIntervalRef.current = null;
    }
    if (autoDetectIntervalRef.current) {
      clearInterval(autoDetectIntervalRef.current);
      autoDetectIntervalRef.current = null;
    }
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    if (remoteViewerRef.current) {
      remoteViewerRef.current.disconnect();
      remoteViewerRef.current = null;
    }
    setIsActive(false);
    setIsDetecting(false);
    setIsCalibrated(false);
    setPendingScore(null);
    setDebugImages({});
    setActiveRemoteCamera(null);
    setBoardConfidence(0);
    referenceFrameRef.current = null;
    pendingAfterFrameRef.current = null;
    calibrationRef.current = null;
    boardResultRef.current = null;
    homographyRef.current = null;
    lastFrameDataRef.current = null;
    motionHistoryRef.current = [];
    motionDetectedRef.current = false;
    stableCountRef.current = 0;
  }, []);

  const switchCamera = useCallback(async () => {
    if (!videoRef.current || availableCameras.length <= 1) return;

    const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
    setCurrentCameraIndex(nextIndex);

    const nextCamera = availableCameras[nextIndex];

    stopCamera();
    await new Promise(resolve => setTimeout(resolve, 100));
    await startCamera(nextCamera.deviceId);
  }, [availableCameras, currentCameraIndex, startCamera, stopCamera]);

  const selectCamera = useCallback(async (cameraIndex: number) => {
    if (!videoRef.current || cameraIndex < 0 || cameraIndex >= availableCameras.length) return;

    setCurrentCameraIndex(cameraIndex);
    const selectedCamera = availableCameras[cameraIndex];

    stopCamera();
    await new Promise(resolve => setTimeout(resolve, 100));
    await startCamera(selectedCamera.deviceId);
    setShowCameraSettings(false);
  }, [availableCameras, startCamera, stopCamera]);

  const connectToRemoteCamera = useCallback(async (session: RemoteCameraSession) => {
    if (!videoRef.current) return;

    setConnectingRemoteId(session.id);
    stopCamera();

    if (remoteViewerRef.current) {
      await remoteViewerRef.current.disconnect();
      remoteViewerRef.current = null;
    }

    const viewer = new RemoteCameraViewer({
      onStream: (stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsActive(true);
          setActiveRemoteCamera(session.id);
          setConnectingRemoteId(null);
          setShowCameraSettings(false);

          checkConnection(false);
          setTimeout(() => {
            runInitialCalibration();
          }, 500);
        }
      },
      onStatusChange: (status) => {
        if (status === 'disconnected') {
          setIsActive(false);
          setActiveRemoteCamera(null);
        }
      },
      onError: (err) => {
        setError(`Tavoli kamera hiba: ${err}`);
        setConnectingRemoteId(null);
      },
    });

    remoteViewerRef.current = viewer;
    const success = await viewer.connectToSession(session.id);
    if (!success) {
      setError('Nem sikerult csatlakozni a tavoli kamerahoz');
      setConnectingRemoteId(null);
    }
  }, [stopCamera, checkConnection, runInitialCalibration]);

  const lastFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const motionHistoryRef = useRef<number[]>([]);
  const MOTION_HISTORY_SIZE = 5;
  const MOTION_THRESHOLD_HIGH = 15;
  const MOTION_THRESHOLD_LOW = 3;

  const measureMotion = useCallback((video: HTMLVideoElement): number => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    const sampleSize = 80;
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    ctx.drawImage(video, 0, 0, sampleSize, sampleSize);

    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
    const currentData = imageData.data;

    if (!lastFrameDataRef.current) {
      lastFrameDataRef.current = new Uint8ClampedArray(currentData);
      return 0;
    }

    let totalDiff = 0;
    let changedPixels = 0;
    const pixelCount = currentData.length / 4;

    for (let i = 0; i < currentData.length; i += 4) {
      const rDiff = Math.abs(currentData[i] - lastFrameDataRef.current[i]);
      const gDiff = Math.abs(currentData[i + 1] - lastFrameDataRef.current[i + 1]);
      const bDiff = Math.abs(currentData[i + 2] - lastFrameDataRef.current[i + 2]);
      const pixelDiff = (rDiff + gDiff + bDiff) / 3;

      if (pixelDiff > 20) {
        changedPixels++;
        totalDiff += pixelDiff;
      }
    }

    lastFrameDataRef.current = new Uint8ClampedArray(currentData);

    const motionPercent = (changedPixels / pixelCount) * 100;
    return motionPercent;
  }, []);

  const triggerThrowDetectionRef = useRef<() => void>(() => {});

  const triggerThrowDetection = useCallback(async () => {
    if (!videoRef.current || !isCalibrated || !referenceFrameRef.current || isDetecting) return;

    setIsDetecting(true);

    try {
      const afterFrame = await captureHighQualityFrame(videoRef.current);

      const result = await scoreThrow(
        referenceFrameRef.current,
        afterFrame,
        homographyRef.current || undefined
      );

      if (result) {
        if (result.debug) {
          setDebugImages({
            diff: result.debug.diff_preview,
            mask: result.debug.mask_preview,
            canonical: result.debug.canonical_preview || result.debug.canonical_after,
          });
        }

        if (result.decision === 'AUTO' && result.confidence >= AUTO_SUBMIT_CONFIDENCE) {
          const target = parseScoreToTarget(result.label);
          onThrow(target);
          referenceFrameRef.current = afterFrame;
          await setReferenceImage(afterFrame);
        } else {
          setPendingScore(result);
          pendingAfterFrameRef.current = afterFrame;
        }
      }
    } catch (err) {
      console.error('[Camera] Throw detection error:', err);
    } finally {
      setIsDetecting(false);
    }
  }, [isCalibrated, isDetecting, onThrow]);

  useEffect(() => {
    triggerThrowDetectionRef.current = triggerThrowDetection;
  }, [triggerThrowDetection]);

  const motionDetectedRef = useRef<boolean>(false);
  const stableCountRef = useRef<number>(0);
  const STABLE_FRAMES_NEEDED = 4;

  const checkForDartThrow = useCallback(() => {
    if (!videoRef.current || !isCalibrated || !autoDetectEnabled || isDetecting || pendingScore || throwCooldownRef.current || remainingDarts <= 0) {
      return;
    }

    const motion = measureMotion(videoRef.current);

    motionHistoryRef.current.push(motion);
    if (motionHistoryRef.current.length > MOTION_HISTORY_SIZE) {
      motionHistoryRef.current.shift();
    }

    if (motion > MOTION_THRESHOLD_HIGH) {
      motionDetectedRef.current = true;
      stableCountRef.current = 0;
    }

    if (motionDetectedRef.current && motion < MOTION_THRESHOLD_LOW) {
      stableCountRef.current++;

      if (stableCountRef.current >= STABLE_FRAMES_NEEDED) {
        motionDetectedRef.current = false;
        stableCountRef.current = 0;
        throwCooldownRef.current = true;

        setTimeout(() => {
          throwCooldownRef.current = false;
        }, 1200);

        triggerThrowDetectionRef.current();
      }
    }
  }, [isCalibrated, autoDetectEnabled, isDetecting, pendingScore, measureMotion, remainingDarts]);

  useEffect(() => {
    if (isActive && isCalibrated && autoDetectEnabled) {
      autoDetectIntervalRef.current = window.setInterval(checkForDartThrow, 200);
    }

    return () => {
      if (autoDetectIntervalRef.current) {
        clearInterval(autoDetectIntervalRef.current);
        autoDetectIntervalRef.current = null;
      }
    };
  }, [isActive, isCalibrated, autoDetectEnabled, checkForDartThrow]);

  const confirmPendingScore = useCallback(async () => {
    if (pendingScore) {
      const target = parseScoreToTarget(pendingScore.label);
      onThrow(target);
      setPendingScore(null);

      if (pendingAfterFrameRef.current) {
        referenceFrameRef.current = pendingAfterFrameRef.current;
        await setReferenceImage(pendingAfterFrameRef.current);
        pendingAfterFrameRef.current = null;
      } else if (videoRef.current) {
        const frame = await captureVideoFrame(videoRef.current);
        referenceFrameRef.current = frame;
        await setReferenceImage(frame);
      }
    }
  }, [pendingScore, onThrow]);

  const rejectPendingScore = useCallback(async () => {
    setPendingScore(null);

    if (videoRef.current) {
      const frame = await captureVideoFrame(videoRef.current);
      referenceFrameRef.current = frame;
      await setReferenceImage(frame);
    }
    pendingAfterFrameRef.current = null;
  }, []);

  const resetReference = useCallback(async () => {
    if (!videoRef.current) return;

    setStatusMessage('Referencia frissitese...');
    try {
      const frameBlob = await captureVideoFrame(videoRef.current);
      await setReferenceImage(frameBlob);
      referenceFrameRef.current = frameBlob;
      setStatusMessage('Referencia OK!');
      setTimeout(() => setStatusMessage(null), 1500);
    } catch {
      setError('Referencia frissites sikertelen');
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  useEffect(() => {
    if (isActive && canvasRef.current && videoRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let animationId: number;

      const draw = () => {
        if (video.readyState >= 2) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          ctx.drawImage(video, 0, 0);

          const boardResult = boardResultRef.current;
          if (boardResult && boardResult.board_found && boardResult.overlay_points) {
            const points = boardResult.overlay_points;

            ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 5]);

            ctx.beginPath();
            if (points.length > 0) {
              ctx.moveTo(points[0][0], points[0][1]);
              for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i][0], points[i][1]);
              }
              ctx.closePath();
            }
            ctx.stroke();

            ctx.setLineDash([]);

            if (boardResult.bull_center) {
              const [bx, by] = boardResult.bull_center;

              ctx.fillStyle = 'rgba(34, 197, 94, 1)';
              ctx.shadowColor = 'rgba(34, 197, 94, 0.8)';
              ctx.shadowBlur = 12;
              ctx.beginPath();
              ctx.arc(bx, by, 8, 0, Math.PI * 2);
              ctx.fill();
              ctx.shadowBlur = 0;

              ctx.fillStyle = '#fff';
              ctx.beginPath();
              ctx.arc(bx, by, 3, 0, Math.PI * 2);
              ctx.fill();

              ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(bx - 20, by);
              ctx.lineTo(bx + 20, by);
              ctx.moveTo(bx, by - 20);
              ctx.lineTo(bx, by + 20);
              ctx.stroke();
            }

            if (boardResult.ellipse) {
              const { cx, cy, a, b, angle } = boardResult.ellipse;

              ctx.save();
              ctx.translate(cx, cy);
              ctx.rotate((angle * Math.PI) / 180);

              ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)';
              ctx.lineWidth = 1;
              ctx.setLineDash([5, 5]);
              ctx.beginPath();
              ctx.ellipse(0, 0, a * 0.63, b * 0.63, 0, 0, Math.PI * 2);
              ctx.stroke();

              ctx.beginPath();
              ctx.ellipse(0, 0, a * 0.08, b * 0.08, 0, 0, Math.PI * 2);
              ctx.stroke();

              ctx.restore();
              ctx.setLineDash([]);

              if (showSectorOverlay) {
                const SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
                const rotationOffset = calibrationRef.current?.rotation_offset ?? -9;

                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate((angle * Math.PI) / 180);

                const scaleRatio = Math.min(a, b) / Math.max(a, b);

                for (let i = 0; i < 20; i++) {
                  const baseAngle = i * 18 + rotationOffset;
                  const startAngle = ((baseAngle - 9) * Math.PI) / 180;
                  const midAngle = (baseAngle * Math.PI) / 180;

                  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                  ctx.lineWidth = 1.5;
                  ctx.beginPath();
                  ctx.moveTo(a * 0.08 * Math.sin(startAngle), -b * 0.08 * Math.cos(startAngle));
                  ctx.lineTo(a * 0.98 * Math.sin(startAngle), -b * 0.98 * Math.cos(startAngle));
                  ctx.stroke();

                  const labelDist = 0.78;
                  const labelX = a * labelDist * Math.sin(midAngle);
                  const labelY = -b * labelDist * Math.cos(midAngle);

                  const fontSize = Math.max(10, Math.min(16, Math.min(a, b) * 0.08));
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                  ctx.font = `bold ${fontSize}px sans-serif`;
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                  ctx.shadowBlur = 6;
                  ctx.fillText(String(SEGMENTS[i]), labelX, labelY);
                  ctx.shadowBlur = 0;
                }

                ctx.lineWidth = 2;
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
                ctx.beginPath();
                ctx.ellipse(0, 0, a * 0.58, b * 0.58, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.ellipse(0, 0, a * 0.63, b * 0.63, 0, 0, Math.PI * 2);
                ctx.stroke();

                ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
                ctx.beginPath();
                ctx.ellipse(0, 0, a * 0.95, b * 0.95, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.ellipse(0, 0, a, b, 0, 0, Math.PI * 2);
                ctx.stroke();

                ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
                ctx.beginPath();
                ctx.ellipse(0, 0, a * 0.032, b * 0.032, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.ellipse(0, 0, a * 0.08, b * 0.08, 0, 0, Math.PI * 2);
                ctx.stroke();

                ctx.restore();
              }
            }
          }

          if (isDetecting) {
            const scanY = (Date.now() % 2000) / 2000 * canvas.height;
            const scanGradient = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30);
            scanGradient.addColorStop(0, 'rgba(59, 130, 246, 0)');
            scanGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.3)');
            scanGradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
            ctx.fillStyle = scanGradient;
            ctx.fillRect(0, scanY - 30, canvas.width, 60);
          }
        }
        animationId = requestAnimationFrame(draw);
      };

      draw();
      return () => cancelAnimationFrame(animationId);
    }
  }, [isActive, isDetecting, showSectorOverlay]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-50 bg-dark-900 flex flex-col'
    : 'space-y-3';

  return (
    <div className={containerClasses} ref={containerRef}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute opacity-0 pointer-events-none w-0 h-0"
      />

      <div className={`relative bg-dark-900 rounded-xl overflow-hidden border border-dark-700 ${
        isFullscreen ? 'flex-1' : ''
      }`}>
        {!isActive ? (
          <div className={`flex flex-col items-center justify-center p-8 text-center ${
            isFullscreen ? 'h-full' : 'min-h-[320px]'
          }`}>
            <div className="mb-6">
              {apiConnected ? (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <Wifi className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 text-sm font-medium">Szerver aktiv</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30">
                    <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                    <WifiOff className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-400 text-sm font-medium">Csatlakozas...</span>
                  </div>
                  <span className="text-dark-500 text-xs">{getApiUrl()}</span>
                  <Button
                    onClick={() => checkConnection(true)}
                    variant="ghost"
                    size="sm"
                    className="text-blue-400 hover:text-blue-300"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Ujraprobalkozas
                  </Button>
                </div>
              )}
            </div>

            {remoteCameras.length > 0 && (
              <div className="mb-6 w-full max-w-sm">
                <div className="flex items-center gap-2 mb-3 justify-center">
                  <Smartphone className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-green-400">Tavoli Kamera Elerheto!</span>
                </div>
                <div className="space-y-2">
                  {remoteCameras.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => connectToRemoteCamera(session)}
                      disabled={connectingRemoteId === session.id}
                      className="w-full text-left p-4 rounded-lg bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 hover:border-green-500/50 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Smartphone className="w-5 h-5 text-green-400" />
                          <div>
                            <div className="font-medium text-white">{session.device_name}</div>
                            <div className="text-xs text-dark-400">
                              {session.status === 'waiting' ? 'Varakozik kapcsolodasra...' : 'Kapcsolodva'}
                            </div>
                          </div>
                        </div>
                        {connectingRemoteId === session.id ? (
                          <Loader2 className="w-5 h-5 text-green-400 animate-spin" />
                        ) : (
                          <div className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-medium">
                            Csatlakozas
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="my-4 flex items-center gap-3">
                  <div className="flex-1 h-px bg-dark-600" />
                  <span className="text-dark-500 text-xs">vagy</span>
                  <div className="flex-1 h-px bg-dark-600" />
                </div>
              </div>
            )}

            <div className="relative mb-6">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-dark-700 to-dark-800 border-2 border-dark-600 flex items-center justify-center">
                <Camera className="w-10 h-10 text-dark-400" />
              </div>
            </div>

            <h3 className="text-lg font-semibold text-white mb-2">Kamera Felismeres v3</h3>
            <p className="text-dark-400 mb-6 max-w-sm">
              Valodi tabla detektalas homography-val. Az overlay a backend altal visszakuldott pontokat rajzolja.
            </p>

            <Button
              onClick={() => startCamera()}
              disabled={isConnecting || !apiConnected}
              size="lg"
              className="px-8 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-500/25"
              leftIcon={isConnecting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            >
              {isConnecting ? 'Inditás...' : 'Helyi Kamera Inditas'}
            </Button>
          </div>
        ) : (
          <div className={`relative ${isFullscreen ? 'h-full flex items-center justify-center bg-black' : ''}`}>
            <canvas
              ref={canvasRef}
              className={`${isFullscreen ? 'max-h-full max-w-full object-contain' : 'w-full'}`}
              style={!isFullscreen ? { aspectRatio: '16/9', objectFit: 'contain' } : undefined}
            />

            <div className="absolute top-3 left-3 flex items-center gap-2 min-h-[32px]">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm transition-all ${
                isCalibrated
                  ? 'bg-green-500/20 border border-green-500/40'
                  : 'bg-amber-500/20 border border-amber-500/40'
              }`}>
                {isCalibrated ? (
                  <>
                    <Target className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 text-xs font-medium">Tabla OK</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                    <span className="text-amber-400 text-xs font-medium">Keresés...</span>
                  </>
                )}
              </div>

              {isDetecting && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/40 backdrop-blur-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-blue-400 text-xs font-medium">Feldolgozas</span>
                </div>
              )}
            </div>

            <div className="absolute top-3 right-3 flex gap-1.5">
              <button
                onClick={stopCamera}
                className="p-2 rounded-lg bg-red-500/80 hover:bg-red-500 backdrop-blur-sm border border-red-400/50 text-white transition-all shadow-lg hover:shadow-red-500/50"
                title="Kamera leallitas"
              >
                <CameraOff className="w-4 h-4" />
              </button>

              {availableCameras.length > 0 && (
                <button
                  onClick={() => setShowCameraSettings(true)}
                  disabled={isConnecting}
                  className="p-2 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Kamera beallitasok"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}

              {availableCameras.length > 1 && (
                <button
                  onClick={switchCamera}
                  disabled={isConnecting}
                  className="p-2 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={`Kamera valtas (${currentCameraIndex + 1}/${availableCameras.length})`}
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={() => setShowDebug(!showDebug)}
                className={`p-2 rounded-lg backdrop-blur-sm border transition-colors ${
                  showDebug
                    ? 'bg-blue-500/30 border-blue-500/50 text-blue-300'
                    : 'bg-black/60 hover:bg-black/80 border-white/10 text-white/70 hover:text-white'
                }`}
                title="Debug panel"
              >
                <Bug className="w-4 h-4" />
              </button>

              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white transition-colors"
                title={isFullscreen ? 'Kicsinyites' : 'Teljes kepernyo'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>

            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
              <div className="flex gap-1.5">
                <button
                  onClick={resetReference}
                  className="p-2.5 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white transition-colors"
                  title="Referencia frissites"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>

                <button
                  onClick={() => {
                    setIsCalibrated(false);
                    boardResultRef.current = null;
                    calibrationRef.current = null;
                  }}
                  className="p-2.5 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white transition-colors"
                  title="Tabla ujrafelismerese"
                >
                  <Crosshair className="w-5 h-5" />
                </button>
              </div>

              <div className="flex gap-1.5">
                {isCalibrated && !pendingScore && (
                  <button
                    onClick={triggerThrowDetection}
                    disabled={isDetecting || disabled}
                    className="px-4 py-2.5 rounded-lg bg-green-500/80 hover:bg-green-500 backdrop-blur-sm border border-green-400/50 text-white font-medium transition-colors disabled:opacity-40 flex items-center gap-2"
                    title="Dobas rogzitese"
                  >
                    <Send className="w-5 h-5" />
                    <span>Dobas</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showDebug && isActive && (
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Bug className="w-4 h-4" />
            Debug Previewk
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {debugImages.canonical && (
              <div className="space-y-1">
                <span className="text-xs text-dark-400">Canonical (warp)</span>
                <img src={debugImages.canonical} alt="Canonical" className="w-full rounded border border-dark-600" />
              </div>
            )}
            {debugImages.diff && (
              <div className="space-y-1">
                <span className="text-xs text-dark-400">Diff</span>
                <img src={debugImages.diff} alt="Diff" className="w-full rounded border border-dark-600" />
              </div>
            )}
            {debugImages.mask && (
              <div className="space-y-1">
                <span className="text-xs text-dark-400">Mask</span>
                <img src={debugImages.mask} alt="Mask" className="w-full rounded border border-dark-600" />
              </div>
            )}
          </div>
          {boardResultRef.current && (
            <div className="text-xs text-dark-400 font-mono">
              Confidence: {(boardResultRef.current.confidence * 100).toFixed(0)}% |
              Homography: {boardResultRef.current.homography ? 'Yes' : 'No'} |
              Points: {boardResultRef.current.overlay_points?.length || 0}
            </div>
          )}
        </div>
      )}

      {!isFullscreen && (
        <>
          <div className="min-h-[76px] space-y-3">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-red-300 font-medium">{error}</p>
                </div>
              </div>
            )}

            {isCalibrated && !error && (
              <div className={`rounded-xl p-3 flex items-center gap-3 transition-all duration-300 ${
                boardConfidence >= 0.6
                  ? 'bg-green-500/10 border border-green-500/30'
                  : boardConfidence >= 0.4
                    ? 'bg-amber-500/10 border border-amber-500/30'
                    : 'bg-red-500/10 border border-red-500/30'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  boardConfidence >= 0.6
                    ? 'bg-green-500/20'
                    : boardConfidence >= 0.4
                      ? 'bg-amber-500/20'
                      : 'bg-red-500/20'
                }`}>
                  <Check className={`w-4 h-4 ${
                    boardConfidence >= 0.6
                      ? 'text-green-400'
                      : boardConfidence >= 0.4
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }`} />
                </div>
                <div className="flex-1 flex items-center justify-between">
                  <span className={`font-medium ${
                    boardConfidence >= 0.6
                      ? 'text-green-300'
                      : boardConfidence >= 0.4
                        ? 'text-amber-300'
                        : 'text-red-300'
                  }`}>
                    Tabla OK ({(boardConfidence * 100).toFixed(0)}%)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={recalibrate}
                      disabled={isCalibrating}
                      className="px-2 py-1 rounded text-xs font-medium transition-colors bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50"
                    >
                      {isCalibrating ? 'Kalibralas...' : 'Ujrakalibral'}
                    </button>
                    <button
                      onClick={() => setAutoDetectEnabled(!autoDetectEnabled)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        autoDetectEnabled
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          : 'bg-dark-600 text-dark-400 hover:bg-dark-500'
                      }`}
                    >
                      {autoDetectEnabled ? 'Auto' : 'Manual'}
                    </button>
                    <button
                      onClick={() => setShowSectorOverlay(!showSectorOverlay)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        showSectorOverlay
                          ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                          : 'bg-dark-600 text-dark-400 hover:bg-dark-500'
                      }`}
                    >
                      Szektorok
                    </button>
                  </div>
                </div>
              </div>
            )}

            {statusMessage && !error && !isCalibrated && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-blue-300 font-medium">{statusMessage}</p>
              </div>
            )}
          </div>

          {pendingScore && (
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-2xl font-bold text-amber-300">{pendingScore.label}</p>
                  <p className="text-lg text-amber-200">{pendingScore.score} pont</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1.5 w-24 bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                        style={{ width: `${pendingScore.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-amber-400/70 text-sm">
                      {(pendingScore.confidence * 100).toFixed(0)}% | {pendingScore.decision}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={confirmPendingScore}
                  className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 shadow-lg shadow-green-500/20"
                  leftIcon={<Check className="w-4 h-4" />}
                >
                  Elfogadom
                </Button>
                <Button
                  variant="outline"
                  onClick={rejectPendingScore}
                  className="flex-1 border-dark-600 hover:bg-dark-700"
                  leftIcon={<X className="w-4 h-4" />}
                >
                  Elutasitom
                </Button>
              </div>
            </div>
          )}

          <div className="min-h-[52px]">
            {isActive && isCalibrated && !pendingScore && (
              <div className="flex items-center justify-between px-4 py-3 bg-dark-800/50 rounded-xl border border-dark-700">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping opacity-50" />
                  </div>
                  <span className="text-dark-300 text-sm font-medium">
                    Kesz - Nyomd meg a "Dobas" gombot
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-dark-500 text-sm">{remainingDarts} nyil hatra</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {isFullscreen && pendingScore && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-dark-800 border border-dark-600 rounded-xl p-4 shadow-2xl w-80">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xl font-bold text-amber-300">{pendingScore.label}</p>
              <p className="text-sm text-amber-200">{pendingScore.score} pont</p>
            </div>
            <span className="text-amber-400/70 text-sm">{(pendingScore.confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={confirmPendingScore}
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-500"
              leftIcon={<Check className="w-4 h-4" />}
            >
              OK
            </Button>
            <Button
              variant="outline"
              onClick={rejectPendingScore}
              size="sm"
              className="flex-1"
              leftIcon={<X className="w-4 h-4" />}
            >
              Nem
            </Button>
          </div>
        </div>
      )}

      {showCameraSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 rounded-xl border border-dark-700 shadow-2xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Camera className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Kamera valasztas</h3>
                  <p className="text-sm text-dark-400">Valassz az elerheto kamerak kozul</p>
                </div>
              </div>
              <button
                onClick={() => setShowCameraSettings(false)}
                className="p-2 hover:bg-dark-700 rounded-lg transition-colors text-dark-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {remoteCameras.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Smartphone className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-green-400">Tavoli Kamerak</span>
                </div>
                <div className="space-y-2">
                  {remoteCameras.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => connectToRemoteCamera(session)}
                      disabled={connectingRemoteId === session.id}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        activeRemoteCamera === session.id
                          ? 'bg-green-500/20 border-green-500/50 text-green-300'
                          : 'bg-dark-700 border-dark-600 text-white hover:bg-dark-600 hover:border-green-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Smartphone className={`w-5 h-5 ${activeRemoteCamera === session.id ? 'text-green-400' : 'text-green-400/60'}`} />
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {session.device_name}
                              {session.status === 'waiting' && (
                                <span className="text-xs text-amber-400">(varakozik)</span>
                              )}
                            </div>
                            <div className="text-xs text-dark-400 mt-0.5">
                              Tavoli {session.device_type}
                            </div>
                          </div>
                        </div>
                        {connectingRemoteId === session.id ? (
                          <Loader2 className="w-5 h-5 text-green-400 animate-spin" />
                        ) : activeRemoteCamera === session.id ? (
                          <div className="flex items-center gap-2 text-green-400">
                            <Wifi className="w-5 h-5" />
                            <span className="text-sm font-medium">Aktiv</span>
                          </div>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {availableCameras.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Camera className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">Helyi Kamerak</span>
                </div>
                <div className="space-y-2">
                  {availableCameras.map((camera, index) => (
                    <button
                      key={camera.deviceId}
                      onClick={() => selectCamera(index)}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        index === currentCameraIndex && !activeRemoteCamera
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                          : 'bg-dark-700 border-dark-600 text-white hover:bg-dark-600 hover:border-dark-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Camera className={`w-5 h-5 ${index === currentCameraIndex && !activeRemoteCamera ? 'text-blue-400' : 'text-dark-400'}`} />
                          <div>
                            <div className="font-medium">{camera.label}</div>
                            <div className="text-xs text-dark-400 mt-0.5">
                              {camera.deviceId.slice(0, 16)}...
                            </div>
                          </div>
                        </div>
                        {index === currentCameraIndex && !activeRemoteCamera && (
                          <div className="flex items-center gap-2 text-blue-400">
                            <Check className="w-5 h-5" />
                            <span className="text-sm font-medium">Aktiv</span>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {availableCameras.length === 0 && remoteCameras.length === 0 && (
              <div className="text-center py-8 text-dark-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nem talalhato kamera</p>
                <p className="text-xs mt-2">Oszd meg a kamerad egy masik eszkozrol</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
