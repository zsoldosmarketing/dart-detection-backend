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
} from 'lucide-react';
import { Button } from '../ui/Button';
import { CameraManager } from '../../lib/cameraManager';
import type { DartTarget } from '../../lib/dartsEngine';
import {
  checkApiHealth,
  setReferenceImage,
  parseScoreToTarget,
  captureVideoFrame,
  autoCalibrate,
  detectDartAdvanced,
  type AutoCalibrationResult,
} from '../../lib/dartDetectionApi';

interface CameraDetectionInputProps {
  onThrow: (target: DartTarget) => void;
  disabled?: boolean;
  remainingDarts?: number;
}

const API_URL = import.meta.env.VITE_DART_DETECTION_API_URL || 'https://dart-detection-api.onrender.com';
const DETECTION_INTERVAL_MS = 800;
const AUTO_SUBMIT_CONFIDENCE = 0.75;

export function CameraDetectionInput({
  onThrow,
  disabled = false,
  remainingDarts = 3,
}: CameraDetectionInputProps) {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingScore, setPendingScore] = useState<{ score: string; target: DartTarget; confidence: number } | null>(null);
  const [lastDetectedDarts, setLastDetectedDarts] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<CameraManager | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  const referenceFrameRef = useRef<Blob | null>(null);
  const calibrationRef = useRef<AutoCalibrationResult | null>(null);

  const checkConnection = useCallback(async () => {
    try {
      const health = await checkApiHealth();
      if (health) {
        setApiConnected(true);
        return true;
      }
    } catch {
      // ignore
    }
    setApiConnected(false);
    return false;
  }, []);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;

    setError(null);
    setIsConnecting(true);
    setStatusMessage('Kamera inditasa...');

    const connected = await checkConnection();
    if (!connected) {
      setError('Nem sikerult csatlakozni a felismero szerverhez. Ellenorizd, hogy a backend fut-e.');
      setIsConnecting(false);
      setStatusMessage(null);
      return;
    }

    const camera = new CameraManager();
    cameraRef.current = camera;

    const success = await camera.start(videoRef.current);
    if (!success) {
      setError('Nem sikerult elinditani a kamerat. Engedelyezd a kamera hasznalatat.');
      setIsConnecting(false);
      setStatusMessage(null);
      return;
    }

    setIsActive(true);
    setIsConnecting(false);

    setTimeout(async () => {
      await runAutoCalibration();
    }, 1000);
  }, [checkConnection]);

  const stopCamera = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    setIsActive(false);
    setIsDetecting(false);
    setIsCalibrated(false);
    setPendingScore(null);
    referenceFrameRef.current = null;
    calibrationRef.current = null;
  }, []);

  const runAutoCalibration = useCallback(async () => {
    if (!videoRef.current) return;

    setIsCalibrating(true);
    setError(null);
    setStatusMessage('Tabla felismerese...');

    try {
      const frameBlob = await captureVideoFrame(videoRef.current);
      const result = await autoCalibrate(frameBlob);

      if (result && result.success) {
        calibrationRef.current = result;
        setIsCalibrated(true);
        setStatusMessage(`Tabla felismerve! (${(result.confidence * 100).toFixed(0)}% biztossag)`);

        await setReferenceImage(frameBlob);
        referenceFrameRef.current = frameBlob;

        setTimeout(() => {
          setStatusMessage(null);
          startDetectionLoop();
        }, 1500);
      } else {
        setError(result?.message || 'Nem talaltam darttablat. Mozditsd a kamerat, hogy latszodjon a tabla.');
        setStatusMessage(null);
      }
    } catch (err) {
      console.error('Calibration error:', err);
      setError('Hiba a tabla felismeresekor. Probald ujra.');
      setStatusMessage(null);
    } finally {
      setIsCalibrating(false);
    }
  }, []);

  const startDetectionLoop = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }

    setLastDetectedDarts(0);

    detectionIntervalRef.current = window.setInterval(async () => {
      if (!videoRef.current || disabled || pendingScore) return;

      setIsDetecting(true);

      try {
        const currentFrame = await captureVideoFrame(videoRef.current);
        const result = await detectDartAdvanced(currentFrame, referenceFrameRef.current || undefined);

        if (result && result.darts && result.darts.length > 0) {
          const newDartCount = result.darts.length;

          if (newDartCount > lastDetectedDarts) {
            const latestDart = result.darts[result.darts.length - 1];
            const target = parseScoreToTarget(latestDart.score);

            if (latestDart.confidence >= AUTO_SUBMIT_CONFIDENCE) {
              onThrow(target);
              setLastDetectedDarts(newDartCount);
              referenceFrameRef.current = currentFrame;
            } else {
              setPendingScore({
                score: latestDart.score,
                target,
                confidence: latestDart.confidence,
              });
            }
          }
        }
      } catch (err) {
        console.error('Detection error:', err);
      } finally {
        setIsDetecting(false);
      }
    }, DETECTION_INTERVAL_MS);
  }, [disabled, pendingScore, lastDetectedDarts, onThrow]);

  const confirmPendingScore = useCallback(() => {
    if (pendingScore) {
      onThrow(pendingScore.target);
      setLastDetectedDarts(prev => prev + 1);
      setPendingScore(null);

      if (videoRef.current) {
        captureVideoFrame(videoRef.current).then(frame => {
          referenceFrameRef.current = frame;
        });
      }
    }
  }, [pendingScore, onThrow]);

  const rejectPendingScore = useCallback(() => {
    setPendingScore(null);
  }, []);

  const resetReference = useCallback(async () => {
    if (!videoRef.current) return;

    setStatusMessage('Referencia kep frissitese...');
    try {
      const frameBlob = await captureVideoFrame(videoRef.current);
      await setReferenceImage(frameBlob);
      referenceFrameRef.current = frameBlob;
      setLastDetectedDarts(0);
      setStatusMessage('Referencia frissitve!');
      setTimeout(() => setStatusMessage(null), 1500);
    } catch {
      setError('Nem sikerult frissiteni a referenciat');
    }
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

          if (calibrationRef.current && calibrationRef.current.success) {
            const { center_x, center_y, radius } = calibrationRef.current;
            if (center_x && center_y && radius) {
              ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
              ctx.lineWidth = 2;
              ctx.setLineDash([8, 4]);
              ctx.beginPath();
              ctx.arc(center_x, center_y, radius, 0, Math.PI * 2);
              ctx.stroke();
              ctx.setLineDash([]);

              ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
              ctx.beginPath();
              ctx.arc(center_x, center_y, 6, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          if (isDetecting) {
            ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
            ctx.fillRect(0, 0, canvas.width, 4);
          }
        }
        animationId = requestAnimationFrame(draw);
      };

      draw();
      return () => cancelAnimationFrame(animationId);
    }
  }, [isActive, isDetecting]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="space-y-3">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute opacity-0 pointer-events-none w-0 h-0"
      />

      <div className="relative bg-dark-800 rounded-xl overflow-hidden border border-dark-700">
        {!isActive ? (
          <div className="aspect-video flex flex-col items-center justify-center p-6 text-center">
            <div className="mb-4">
              {apiConnected ? (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <Wifi className="w-4 h-4" />
                  <span>Szerver kapcsolat OK</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-400 text-sm">
                  <WifiOff className="w-4 h-4" />
                  <span>Szerver ellenorzese...</span>
                </div>
              )}
            </div>
            <Camera className="w-16 h-16 text-dark-500 mb-4" />
            <p className="text-dark-400 mb-4">
              Inditsd el a kamerat az automatikus dobas felismereshez
            </p>
            <Button
              onClick={startCamera}
              disabled={isConnecting}
              size="lg"
              leftIcon={isConnecting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            >
              {isConnecting ? 'Csatlakozas...' : 'Kamera Inditas'}
            </Button>
          </div>
        ) : (
          <>
            <canvas ref={canvasRef} className="w-full" style={{ maxHeight: '280px', objectFit: 'contain' }} />

            <div className="absolute top-2 left-2 flex items-center gap-2">
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                isCalibrated ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {isCalibrated ? 'Tabla OK' : 'Kalibralas...'}
              </div>
              {isDetecting && (
                <div className="px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-400 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Figyeles
                </div>
              )}
            </div>

            <div className="absolute top-2 right-2 flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={runAutoCalibration}
                disabled={isCalibrating}
                className="bg-black/50 hover:bg-black/70"
                title="Tabla ujrafelismerese"
              >
                <Crosshair className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetReference}
                className="bg-black/50 hover:bg-black/70"
                title="Referencia frissites"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={stopCamera}
                className="bg-black/50 hover:bg-black/70"
                title="Kamera leallitas"
              >
                <CameraOff className="w-4 h-4" />
              </Button>
            </div>

            {isCalibrating && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                <RefreshCw className="w-10 h-10 text-blue-400 animate-spin mb-3" />
                <p className="text-blue-300 font-medium">Tabla felismerese...</p>
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 text-sm">{error}</p>
            {isActive && !isCalibrated && (
              <Button
                size="sm"
                variant="outline"
                onClick={runAutoCalibration}
                className="mt-2"
              >
                Ujra probalom
              </Button>
            )}
          </div>
        </div>
      )}

      {statusMessage && !error && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-center gap-2">
          <Check className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <p className="text-blue-300 text-sm">{statusMessage}</p>
        </div>
      )}

      {pendingScore && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-lg font-bold text-amber-300">{pendingScore.score}</p>
              <p className="text-amber-400/70 text-sm">
                Biztossag: {(pendingScore.confidence * 100).toFixed(0)}%
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={confirmPendingScore}
              className="flex-1 bg-green-600 hover:bg-green-700"
              leftIcon={<Check className="w-4 h-4" />}
            >
              Elfogadom
            </Button>
            <Button
              variant="outline"
              onClick={rejectPendingScore}
              className="flex-1"
              leftIcon={<X className="w-4 h-4" />}
            >
              Melledobas
            </Button>
          </div>
        </div>
      )}

      {isActive && isCalibrated && !pendingScore && (
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-dark-400 text-sm">
              Automatikus felismeres aktiv ({remainingDarts} nyil hatra)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
