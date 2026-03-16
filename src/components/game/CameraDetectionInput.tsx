import { useState, useRef, useEffect, useCallback } from 'react';
import { t } from '../../lib/i18n';
import {
  Camera,
  CameraOff,
  RefreshCw,
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
import { useCameraStore } from '../../stores/cameraStore';
import {
  checkApiHealth,
  detectBoard,
  scoreThrow,
  setReferenceImage,
  parseScoreToTarget,
  captureVideoFrame,
  captureHighQualityFrame,
  boardDetectToCalibration,
  type BoardDetectResult,
  type ThrowScoreResult,
  type AutoCalibrationResult,
} from '../../lib/dartDetectionApi';
import { drawFrame } from './CameraCanvasRenderer';
import { ScoreConfirmationDialog } from './ScoreConfirmationDialog';
import { CameraSettingsModal } from './CameraSettingsModal';
import { CalibrationStatusBar } from './CalibrationStatusBar';

interface CameraDetectionInputProps {
  onThrow: (target: DartTarget) => void;
  disabled?: boolean;
  remainingDarts?: number;
}

const BOARD_DETECT_INTERVAL = 3000;
const AUTO_SUBMIT_CONFIDENCE = 0.70;

export function CameraDetectionInput({
  onThrow,
  disabled = false,
  remainingDarts = 3,
}: CameraDetectionInputProps) {
  const { user } = useAuthStore();
  const cameraStore = useCameraStore();
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const apiConnectedRef = useRef(false);
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
  const [currentCameraIndex, setCurrentCameraIndex] = useState(cameraStore.lastCameraIndex);
  const [remoteCameras, setRemoteCameras] = useState<RemoteCameraSession[]>([]);
  const [connectingRemoteId, setConnectingRemoteId] = useState<string | null>(null);
  const [activeRemoteCamera, setActiveRemoteCamera] = useState<string | null>(null);
  const [boardConfidence, setBoardConfidence] = useState<number>(0);
  const [autoDetectEnabled, setAutoDetectEnabled] = useState(cameraStore.autoDetectEnabled);
  const [showSectorOverlay, setShowSectorOverlay] = useState(false);
  const [autoZoomEnabled, setAutoZoomEnabled] = useState(cameraStore.autoZoomEnabled);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<CameraManager | null>(null);
  const boardDetectIntervalRef = useRef<number | null>(null);
  const isCalibratedRef = useRef(false);
  const boardDetectingRef = useRef(false);
  const referenceFrameRef = useRef<Blob | null>(null);
  const calibrationRef = useRef<AutoCalibrationResult | null>(null);
  const boardResultRef = useRef<BoardDetectResult | null>(null);
  const homographyRef = useRef<number[][] | null>(null);
  const remoteViewerRef = useRef<RemoteCameraViewer | null>(null);
  const pendingAfterFrameRef = useRef<Blob | null>(null);
  const lastBrightnessRef = useRef<number | null>(null);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const brightnessStableCountRef = useRef<number>(0);
  const motionDetectedRef = useRef<boolean>(false);
  const motionMagnitudeRef = useRef<number>(0);
  const autoDetectIntervalRef = useRef<number | null>(null);
  const throwCooldownRef = useRef<boolean>(false);
  const zoomRegionRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const lastDartHitRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadRemoteCameras = async () => {
      const sessions = await getActiveRemoteCameras();
      setRemoteCameras(sessions);
      return sessions;
    };
    loadRemoteCameras();

    const pollInterval = setInterval(loadRemoteCameras, 5000);

    const channel = subscribeToRemoteCameras(user.id, (sessions) => {
      setRemoteCameras(sessions);
    });

    return () => {
      clearInterval(pollInterval);
      channel.unsubscribe();
    };
  }, [user]);


  const checkConnection = useCallback(async (showStatus = false) => {
    if (showStatus) {
      setStatusMessage(t('camera.connecting'));
    }
    try {
      const health = await checkApiHealth();
      if (health) {
        apiConnectedRef.current = true;
        setApiConnected(true);
        if (showStatus) {
          setStatusMessage(null);
        }
        return true;
      }
    } catch (err) {
      console.error('[Camera] Connection error:', err);
    }
    apiConnectedRef.current = false;
    setApiConnected(false);
    if (showStatus) {
      setStatusMessage(t('camera.server_offline'));
      setTimeout(() => setStatusMessage(null), 8000);
    }
    return false;
  }, []);

  useEffect(() => {
    checkConnection(true);
    const interval = setInterval(() => checkConnection(false), 30000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  const runBoardDetection = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !apiConnectedRef.current) return;
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return;
    if (boardDetectingRef.current || isCalibratedRef.current) return;
    boardDetectingRef.current = true;

    try {
      const frameBlob = await captureVideoFrame(video);
      const result = await detectBoard(frameBlob);

      if (result && result.board_found && result.ellipse) {
        const imgW = result.image_width ?? video.videoWidth;
        const imgH = result.image_height ?? video.videoHeight;
        const scaleX = video.videoWidth / imgW;
        const scaleY = video.videoHeight / imgH;

        const scaledResult = {
          ...result,
          ellipse: {
            ...result.ellipse,
            cx: result.ellipse.cx * scaleX,
            cy: result.ellipse.cy * scaleY,
            a: result.ellipse.a * scaleX,
            b: result.ellipse.b * scaleY,
          },
          bull_center: result.bull_center
            ? [result.bull_center[0] * scaleX, result.bull_center[1] * scaleY]
            : null,
          overlay_points: result.overlay_points
            ? result.overlay_points.map(([x, y]) => [x * scaleX, y * scaleY])
            : null,
        };

        boardResultRef.current = scaledResult;
        homographyRef.current = null;

        const cal = boardDetectToCalibration(scaledResult);
        calibrationRef.current = cal;
        setBoardConfidence(result.confidence);

        isCalibratedRef.current = true;
        setIsCalibrated(true);
        referenceFrameRef.current = frameBlob;
        await setReferenceImage(frameBlob);

        cameraStore.setCalibration(cal);
        cameraStore.setBoardResult(scaledResult);
        cameraStore.setHomography(null);

        if (boardDetectIntervalRef.current) {
          clearInterval(boardDetectIntervalRef.current);
          boardDetectIntervalRef.current = null;
        }
      }
    } catch (err) {
      console.error('[Camera] Board detection error:', err);
    } finally {
      boardDetectingRef.current = false;
    }
  }, []);

  const startBoardDetectLoop = useCallback(() => {
    if (boardDetectIntervalRef.current) {
      clearInterval(boardDetectIntervalRef.current);
    }

    isCalibratedRef.current = false;
    boardDetectingRef.current = false;
    runBoardDetection();

    boardDetectIntervalRef.current = window.setInterval(() => {
      runBoardDetection();
    }, BOARD_DETECT_INTERVAL);
  }, [runBoardDetection]);

  const startCamera = useCallback(async (deviceId?: string) => {
    if (!videoRef.current) return;

    setError(null);
    setIsConnecting(true);
    setStatusMessage(t('camera.starting'));

    const camera = new CameraManager();

    const cameras = await camera.listDevices();
    setAvailableCameras(cameras);

    let selectedDeviceId = deviceId;
    if (!selectedDeviceId && cameras.length > 0) {
      const savedIdx = cameraStore.lastCameraIndex;
      if (savedIdx >= 0 && savedIdx < cameras.length) {
        selectedDeviceId = cameras[savedIdx].deviceId;
      } else {
        const physicalCamera = cameras.find(c =>
          !c.label.toLowerCase().includes('virtual') &&
          !c.label.toLowerCase().includes('obs') &&
          !c.label.toLowerCase().includes('snap') &&
          !c.label.toLowerCase().includes('manycam')
        );
        selectedDeviceId = physicalCamera?.deviceId || cameras[0].deviceId;
      }
    }

    if (selectedDeviceId) {
      camera.setDevice(selectedDeviceId);
    }
    cameraRef.current = camera;

    const success = await camera.start(videoRef.current);
    if (!success) {
      setError(t('camera.start_failed'));
      setIsConnecting(false);
      setStatusMessage(null);
      return;
    }

    setIsActive(true);
    setIsConnecting(false);
    cameraStore.setWasActive(true);

    if (selectedDeviceId) {
      const idx = cameras.findIndex(c => c.deviceId === selectedDeviceId);
      if (idx >= 0) {
        setCurrentCameraIndex(idx);
        cameraStore.setLastCameraIndex(idx);
      }
    }

    let connected = await checkConnection(false);
    if (!connected) {
      await new Promise(r => setTimeout(r, 2000));
      connected = await checkConnection(true);
    }
    if (connected) {
      setStatusMessage(null);
    }

    setTimeout(() => {
      startBoardDetectLoop();
    }, 500);
  }, [checkConnection, startBoardDetectLoop, cameraStore]);

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
    isCalibratedRef.current = false;
    setIsCalibrated(false);
    setPendingScore(null);
    setDebugImages({});
    setActiveRemoteCamera(null);
    setBoardConfidence(0);
    boardDetectingRef.current = false;
    referenceFrameRef.current = null;
    pendingAfterFrameRef.current = null;
    calibrationRef.current = null;
    boardResultRef.current = null;
    homographyRef.current = null;
    lastBrightnessRef.current = null;
    prevFrameDataRef.current = null;
    brightnessStableCountRef.current = 0;
    motionDetectedRef.current = false;
    motionMagnitudeRef.current = 0;
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

          cameraStore.setWasActive(true);
          cameraStore.setLastRemoteCameraId(session.id);

          checkConnection(false);
          setTimeout(() => {
            startBoardDetectLoop();
          }, 500);
        }
      },
      onStatusChange: (status) => {
        if (status === 'disconnected') {
          setIsActive(false);
          setActiveRemoteCamera(null);
          setStatusMessage(null);
          setError('Tavoli kamera kapcsolat megszakadt');
          setTimeout(() => setError(null), 5000);
        } else if (status === 'reconnecting') {
          setStatusMessage(t('camera.reconnecting'));
        } else if (status === 'connected') {
          setStatusMessage(null);
          setError(null);
        }
      },
      onError: (err) => {
        setError(String(err));
        setConnectingRemoteId(null);
        setStatusMessage(null);
      },
    });

    remoteViewerRef.current = viewer;
    const success = await viewer.connectToSession(session.id);
    if (!success) {
      setError(t('camera.remote_connect_failed'));
      setConnectingRemoteId(null);
    }
  }, [stopCamera, checkConnection, startBoardDetectLoop, cameraStore]);

  const restoreCalibrationRef = useRef(async () => {
    if (cameraStore.calibration && cameraStore.homography && videoRef.current) {
      await new Promise(resolve => setTimeout(resolve, 500));
      calibrationRef.current = cameraStore.calibration;
      homographyRef.current = cameraStore.homography;
      boardResultRef.current = cameraStore.boardResult;

      const frame = await captureVideoFrame(videoRef.current);
      referenceFrameRef.current = frame;
      await setReferenceImage(frame);

      setIsCalibrated(true);
      setBoardConfidence(cameraStore.boardResult?.confidence || 0);
    }
  });

  useEffect(() => {
    restoreCalibrationRef.current = async () => {
      if (cameraStore.calibration && cameraStore.homography && videoRef.current) {
        await new Promise(resolve => setTimeout(resolve, 500));
        calibrationRef.current = cameraStore.calibration;
        homographyRef.current = cameraStore.homography;
        boardResultRef.current = cameraStore.boardResult;

        const frame = await captureVideoFrame(videoRef.current);
        referenceFrameRef.current = frame;
        await setReferenceImage(frame);

        setIsCalibrated(true);
        setBoardConfidence(cameraStore.boardResult?.confidence || 0);
      }
    };
  }, [cameraStore.calibration, cameraStore.homography, cameraStore.boardResult]);


  const measureMotion = useCallback((video: HTMLVideoElement): { brightness: number; changedPixelRatio: number; boardRegionChange: number } => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { brightness: 0, changedPixelRatio: 0, boardRegionChange: 0 };

    const sampleSize = 120;
    canvas.width = sampleSize;
    canvas.height = sampleSize;

    const cal = calibrationRef.current;
    if (cal && cal.center && videoRef.current) {
      const vw = video.videoWidth || 1;
      const vh = video.videoHeight || 1;
      const boardCx = cal.center.x / vw;
      const boardCy = cal.center.y / vh;
      const boardR = Math.max(cal.radiusX || 100, cal.radiusY || 100) / Math.min(vw, vh);
      const pad = 1.3;
      const sx = Math.max(0, (boardCx - boardR * pad)) * vw;
      const sy = Math.max(0, (boardCy - boardR * pad)) * vh;
      const sw = Math.min(vw - sx, boardR * pad * 2 * vw);
      const sh = Math.min(vh - sy, boardR * pad * 2 * vh);
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sampleSize, sampleSize);
    } else {
      ctx.drawImage(video, 0, 0, sampleSize, sampleSize);
    }

    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
    const data = imageData.data;
    const totalPixels = data.length / 4;

    let totalBrightness = 0;
    for (let i = 0; i < data.length; i += 4) {
      totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    const brightness = totalBrightness / totalPixels;

    let changedPixels = 0;
    let boardRegionChanged = 0;
    const prev = prevFrameDataRef.current;

    if (prev && prev.length === data.length) {
      const cx = sampleSize / 2;
      const cy = sampleSize / 2;
      const boardR = sampleSize * 0.4;

      for (let y = 0; y < sampleSize; y++) {
        for (let x = 0; x < sampleSize; x++) {
          const idx = (y * sampleSize + x) * 4;
          const diff = Math.abs(data[idx] - prev[idx]) +
                       Math.abs(data[idx + 1] - prev[idx + 1]) +
                       Math.abs(data[idx + 2] - prev[idx + 2]);

          if (diff > 75) {
            changedPixels++;
            const dx = x - cx;
            const dy = y - cy;
            if (Math.sqrt(dx * dx + dy * dy) < boardR) {
              boardRegionChanged++;
            }
          }
        }
      }
    }

    prevFrameDataRef.current = new Uint8ClampedArray(data);

    const boardPixelCount = Math.PI * (sampleSize * 0.4) ** 2;

    return {
      brightness,
      changedPixelRatio: changedPixels / totalPixels,
      boardRegionChange: boardPixelCount > 0 ? boardRegionChanged / boardPixelCount : 0,
    };
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
        if (result.tip_original && result.tip_original.length >= 2) {
          lastDartHitRef.current = { x: result.tip_original[0], y: result.tip_original[1] };
        }

        if (result.decision === 'AUTO' && result.confidence >= AUTO_SUBMIT_CONFIDENCE) {
          const target = parseScoreToTarget(result.label);
          onThrow(target);
          referenceFrameRef.current = afterFrame;
          await setReferenceImage(afterFrame);
          setTimeout(() => { lastDartHitRef.current = null; }, 3000);
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

  const checkForDartThrow = useCallback(() => {
    if (!videoRef.current || !isCalibrated || !autoDetectEnabled || isDetecting || pendingScore || throwCooldownRef.current || remainingDarts <= 0) {
      return;
    }

    const motion = measureMotion(videoRef.current);
    const lastBrightness = lastBrightnessRef.current;

    if (lastBrightness !== null) {
      const brightnessDiff = Math.abs(motion.brightness - lastBrightness);

      if (motion.changedPixelRatio > 0.6) {
        motionDetectedRef.current = false;
        brightnessStableCountRef.current = 0;
        motionMagnitudeRef.current = 0;
        lastBrightnessRef.current = motion.brightness;
        return;
      }

      const hasSignificantMotion = motion.boardRegionChange > 0.03 || brightnessDiff > 20;

      if (hasSignificantMotion) {
        motionDetectedRef.current = true;
        motionMagnitudeRef.current = Math.max(motionMagnitudeRef.current, motion.boardRegionChange);
        brightnessStableCountRef.current = 0;
      } else if (motionDetectedRef.current) {
        const isStable = motion.boardRegionChange < 0.008 && brightnessDiff < 4;

        if (isStable) {
          brightnessStableCountRef.current++;
        } else {
          brightnessStableCountRef.current = Math.max(0, brightnessStableCountRef.current - 1);
        }

        if (brightnessStableCountRef.current >= 6 && motionMagnitudeRef.current > 0.02) {
          throwCooldownRef.current = true;
          brightnessStableCountRef.current = 0;
          motionDetectedRef.current = false;
          motionMagnitudeRef.current = 0;
          setTimeout(() => {
            throwCooldownRef.current = false;
          }, 4000);
          triggerThrowDetectionRef.current();
        }
      }
    }

    lastBrightnessRef.current = motion.brightness;
  }, [isCalibrated, autoDetectEnabled, isDetecting, pendingScore, measureMotion, remainingDarts]);

  useEffect(() => {
    if (isActive && isCalibrated && autoDetectEnabled) {
      autoDetectIntervalRef.current = window.setInterval(checkForDartThrow, 250);
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
      setTimeout(() => { lastDartHitRef.current = null; }, 2000);

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
    lastDartHitRef.current = null;

    if (videoRef.current) {
      const frame = await captureVideoFrame(videoRef.current);
      referenceFrameRef.current = frame;
      await setReferenceImage(frame);
    }
    pendingAfterFrameRef.current = null;
  }, []);

  const resetReference = useCallback(async () => {
    if (!videoRef.current) return;

    setStatusMessage(t('camera.ref_refresh'));
    try {
      const frameBlob = await captureVideoFrame(videoRef.current);
      await setReferenceImage(frameBlob);
      referenceFrameRef.current = frameBlob;
      setStatusMessage(t('camera.ref_ok'));
      setTimeout(() => setStatusMessage(null), 1500);
    } catch {
      setError(t('camera.ref_failed'));
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
        if (video.readyState >= 2 && video.videoWidth > 0) {
          const parent = canvas.parentElement;
          if (parent) {
            const rect = parent.getBoundingClientRect();
            const displayW = Math.round(rect.width);
            const displayH = Math.round(rect.height);
            if (canvas.width !== displayW || canvas.height !== displayH) {
              canvas.width = displayW;
              canvas.height = displayH;
            }
          }
        }

        const zoomRegion = drawFrame({
          ctx,
          canvas,
          video,
          boardResult: boardResultRef.current,
          autoZoomEnabled,
          showSectorOverlay,
          isDetecting,
          lastDartHit: lastDartHitRef.current,
        });
        zoomRegionRef.current = zoomRegion;
        animationId = requestAnimationFrame(draw);
      };

      draw();
      return () => cancelAnimationFrame(animationId);
    }
  }, [isActive, isDetecting, showSectorOverlay, autoZoomEnabled]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-50 bg-dark-900 flex flex-col'
    : 'flex flex-col gap-3 min-h-0 h-full';

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
        isFullscreen ? 'flex-1' : 'flex-1 min-h-[280px]'
      }`}>
        {!isActive ? (
          <div className="flex flex-col items-center p-4 text-center overflow-y-auto h-full justify-center">
            <div className="mb-3 pt-2">
              {apiConnected ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <Wifi className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-green-400 text-xs font-medium">{t('camera.server_active')}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30">
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-400 text-xs font-medium">{t('camera.connecting_label')}</span>
                  </div>
                  <Button
                    onClick={() => checkConnection(true)}
                    variant="ghost"
                    size="sm"
                    className="text-blue-400 hover:text-blue-300 h-7 text-xs"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    {t('camera.retry')}
                  </Button>
                </div>
              )}
            </div>

            {remoteCameras.length > 0 && (
              <div className="mb-3 w-full max-w-sm">
                <div className="flex items-center gap-2 mb-2 justify-center">
                  <Smartphone className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-xs font-medium text-green-400">{t('camera.remote_available')}</span>
                </div>
                <div className="space-y-1.5">
                  {remoteCameras.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => connectToRemoteCamera(session)}
                      disabled={connectingRemoteId === session.id}
                      className="w-full text-left p-3 rounded-lg bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 hover:border-green-500/50 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-green-400 flex-shrink-0" />
                          <div>
                            <div className="font-medium text-white text-sm">{session.device_name}</div>
                            <div className="text-xs text-dark-400">
                              {session.status === 'waiting' ? t('camera.waiting') : t('camera.connected_label')}
                            </div>
                          </div>
                        </div>
                        {connectingRemoteId === session.id ? (
                          <Loader2 className="w-4 h-4 text-green-400 animate-spin flex-shrink-0" />
                        ) : (
                          <div className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium flex-shrink-0">
                            {t('camera.connect')}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="my-3 flex items-center gap-3">
                  <div className="flex-1 h-px bg-dark-600" />
                  <span className="text-dark-500 text-xs">{t('common.or')}</span>
                  <div className="flex-1 h-px bg-dark-600" />
                </div>
              </div>
            )}

            <div className="relative mb-3">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-dark-700 to-dark-800 border-2 border-dark-600 flex items-center justify-center">
                <Camera className="w-7 h-7 text-dark-400" />
              </div>
            </div>

            <h3 className="text-base font-semibold text-white mb-1">{t('camera.detection_title')}</h3>

            <Button
              onClick={() => startCamera()}
              disabled={isConnecting}
              size="sm"
              className="px-6 mt-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-500/25"
              leftIcon={isConnecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            >
              {isConnecting ? t('camera.starting_label') : t('camera.start_local')}
            </Button>
          </div>
        ) : (
          <div className={`relative ${isFullscreen ? 'h-full flex items-center justify-center bg-black' : 'h-full'}`}>
            <canvas
              ref={canvasRef}
              className={`${isFullscreen ? 'max-h-full max-w-full object-contain' : 'w-full h-full object-contain absolute inset-0'}`}
              style={!isFullscreen ? undefined : undefined}
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
                    <span className="text-green-400 text-xs font-medium">{t('camera.board_ok')}</span>
                  </>
                ) : !apiConnected ? (
                  <>
                    <WifiOff className="w-4 h-4 text-red-400" />
                    <span className="text-red-400 text-xs font-medium">{t('camera.backend_offline')}</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                    <span className="text-amber-400 text-xs font-medium">{t('camera.searching_board')}</span>
                  </>
                )}
              </div>

              {isDetecting && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/40 backdrop-blur-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-blue-400 text-xs font-medium">{t('camera.processing')}</span>
                </div>
              )}
            </div>

            <div className="absolute top-3 right-3 flex gap-1.5">
              {availableCameras.length > 0 && (
                <button
                  onClick={() => setShowCameraSettings(true)}
                  disabled={isConnecting}
                  className="p-2 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t('camera.settings')}
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}

              {availableCameras.length > 1 && (
                <button
                  onClick={switchCamera}
                  disabled={isConnecting}
                  className="p-2 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t('camera.switch', { current: currentCameraIndex + 1, total: availableCameras.length })}
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
                title={isFullscreen ? t('camera.minimize') : t('camera.fullscreen')}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>

            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
              <div className="flex gap-1.5">
                <button
                  onClick={resetReference}
                  className="p-2.5 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white transition-colors"
                  title={t('camera.refresh_ref')}
                >
                  <RefreshCw className="w-5 h-5" />
                </button>

                <button
                  onClick={() => {
                    isCalibratedRef.current = false;
                    setIsCalibrated(false);
                    boardResultRef.current = null;
                    calibrationRef.current = null;
                    homographyRef.current = null;
                    startBoardDetectLoop();
                  }}
                  className="p-2.5 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white transition-colors"
                  title={t('camera.reboard')}
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
                    title={t('camera.capture')}
                  >
                    <Send className="w-5 h-5" />
                    <span>{t('camera.capture_btn')}</span>
                  </button>
                )}

                <button
                  onClick={stopCamera}
                  className="p-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm border border-red-500/40 text-red-400 hover:text-red-300 transition-colors"
                  title={t('camera.stop')}
                >
                  <CameraOff className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showDebug && isActive && (
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Bug className="w-4 h-4" />
            {t('camera.debug_previews')}
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
          <CalibrationStatusBar
            isCalibrated={isCalibrated}
            isActive={isActive}
            boardConfidence={boardConfidence}
            autoDetectEnabled={autoDetectEnabled}
            autoZoomEnabled={autoZoomEnabled}
            showSectorOverlay={showSectorOverlay}
            error={error}
            statusMessage={statusMessage}
            pendingScore={!!pendingScore}
            remainingDarts={remainingDarts}
            onToggleAutoDetect={() => setAutoDetectEnabled(!autoDetectEnabled)}
            onToggleAutoZoom={() => setAutoZoomEnabled(!autoZoomEnabled)}
            onToggleSectorOverlay={() => setShowSectorOverlay(!showSectorOverlay)}
          />

          {pendingScore && (
            <ScoreConfirmationDialog
              pendingScore={pendingScore}
              isFullscreen={false}
              onConfirm={confirmPendingScore}
              onReject={rejectPendingScore}
            />
          )}
        </>
      )}

      {isFullscreen && pendingScore && (
        <ScoreConfirmationDialog
          pendingScore={pendingScore}
          isFullscreen={true}
          onConfirm={confirmPendingScore}
          onReject={rejectPendingScore}
        />
      )}

      {showCameraSettings && (
        <CameraSettingsModal
          availableCameras={availableCameras}
          remoteCameras={remoteCameras}
          currentCameraIndex={currentCameraIndex}
          activeRemoteCamera={activeRemoteCamera}
          connectingRemoteId={connectingRemoteId}
          onClose={() => setShowCameraSettings(false)}
          onSelectCamera={selectCamera}
          onConnectRemoteCamera={connectToRemoteCamera}
        />
      )}
    </div>
  );
}
