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
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Target,
  Settings2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { CameraManager } from '../../lib/cameraManager';
import type { DartTarget } from '../../lib/dartsEngine';
import {
  checkApiHealth,
  setReferenceImage,
  parseScoreToTarget,
  captureVideoFrame,
  captureHighQualityFrame,
  autoCalibrateWithRetry,
  detectDartAdvanced,
  getApiUrl,
  type AutoCalibrationResult,
} from '../../lib/dartDetectionApi';

interface CameraDetectionInputProps {
  onThrow: (target: DartTarget) => void;
  disabled?: boolean;
  remainingDarts?: number;
}

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [autoZoom, setAutoZoom] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<CameraManager | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  const referenceFrameRef = useRef<Blob | null>(null);
  const calibrationRef = useRef<AutoCalibrationResult | null>(null);

  const checkConnection = useCallback(async (showStatus = false) => {
    if (showStatus) {
      setStatusMessage('Csatlakozas a szerverhez...');
    }
    try {
      console.log('[Camera] Checking backend connection...');
      const health = await checkApiHealth(3);
      console.log('[Camera] Health response:', health);
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
      setStatusMessage('Szerver nem elerheto! (Render free tier alszik vagy lefagyott - varj 1-2 percet)');
      setTimeout(() => setStatusMessage(null), 6000);
    }
    return false;
  }, []);

  useEffect(() => {
    checkConnection(true);
    const interval = setInterval(() => checkConnection(false), 30000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  const applyAutoZoom = useCallback((calibration: AutoCalibrationResult) => {
    if (!autoZoom || !calibration.center_x || !calibration.center_y || !calibration.radius) return;
    if (!videoRef.current) return;

    const videoWidth = videoRef.current.videoWidth;
    const videoHeight = videoRef.current.videoHeight;

    if (videoWidth === 0 || videoHeight === 0) return;

    const suggestedZoom = calibration.suggested_zoom || 1.0;
    const boardVisible = calibration.board_visible_percent || 100;

    let newZoom = 1.0;

    if (boardVisible >= 95) {
      newZoom = Math.min(suggestedZoom, 1.8);
    } else if (boardVisible >= 80) {
      newZoom = Math.min(suggestedZoom * 0.9, 1.5);
    } else {
      newZoom = 1.0;
    }

    newZoom = Math.max(1.0, Math.min(newZoom, 2.0));

    const radiusX = calibration.radius_x || calibration.radius;
    const radiusY = calibration.radius_y || calibration.radius;

    const boardLeft = calibration.center_x - radiusX;
    const boardRight = calibration.center_x + radiusX;
    const boardTop = calibration.center_y - radiusY;
    const boardBottom = calibration.center_y + radiusY;

    const margin = Math.max(radiusX, radiusY) * 0.1;
    const wouldCropLeft = (boardLeft - margin) * newZoom < 0;
    const wouldCropRight = (boardRight + margin) * newZoom > videoWidth * newZoom;
    const wouldCropTop = (boardTop - margin) * newZoom < 0;
    const wouldCropBottom = (boardBottom + margin) * newZoom > videoHeight * newZoom;

    if (wouldCropLeft || wouldCropRight || wouldCropTop || wouldCropBottom) {
      newZoom = Math.max(1.0, newZoom * 0.85);
    }

    const centerOffsetX = calibration.center_x - videoWidth / 2;
    const centerOffsetY = calibration.center_y - videoHeight / 2;

    const panX = -centerOffsetX * (newZoom - 1) / newZoom;
    const panY = -centerOffsetY * (newZoom - 1) / newZoom;

    setZoomLevel(newZoom);
    setPanOffset({ x: panX, y: panY });
  }, [autoZoom]);

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;

    setError(null);
    setIsConnecting(true);
    setStatusMessage('Szerver ebresztese... (Render free tier - akár 60mp)');

    const connected = await checkConnection(false);
    if (!connected) {
      setError('Nem sikerult csatlakozni. A Render szerver esetleg alszik - varj 60mp-et es probald ujra.');
      setIsConnecting(false);
      setStatusMessage(null);
      return;
    }

    setStatusMessage('Kamera inditasa...');

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
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    referenceFrameRef.current = null;
    calibrationRef.current = null;
  }, []);

  const runAutoCalibration = useCallback(async () => {
    if (!videoRef.current) return;

    setIsCalibrating(true);
    setError(null);
    setStatusMessage('Tabla keresese... (tobbszoros modszer)');

    try {
      const frameBlob = await captureHighQualityFrame(videoRef.current);
      const result = await autoCalibrateWithRetry(frameBlob, 2);

      if (result && result.success) {
        calibrationRef.current = result;
        setIsCalibrated(true);
        setError(null);

        const methodInfo = result.method ? ` [${result.method}]` : '';
        const angleInfo = result.is_angled ? ' (szogbol)' : '';
        setStatusMessage(`Tabla OK! (${(result.confidence * 100).toFixed(0)}%)${methodInfo}${angleInfo}`);

        applyAutoZoom(result);

        await setReferenceImage(frameBlob);
        referenceFrameRef.current = frameBlob;

        setTimeout(() => {
          setStatusMessage(null);
          startDetectionLoop();
        }, 1500);
      } else {
        const tips = [
          'Jobb megvilagitas szukseges',
          'Menj kozelebb a tablahoz',
          'A tabla legyen kozepen',
          'Kerüld a tükrözodest',
        ];
        const randomTip = tips[Math.floor(Math.random() * tips.length)];
        setError(`Tabla nem talalhato. Tipp: ${randomTip}`);
        setStatusMessage(null);
      }
    } catch (err) {
      console.error('Calibration error:', err);
      setError('Hiba a tabla felismeresekor. Probald ujra.');
      setStatusMessage(null);
    } finally {
      setIsCalibrating(false);
    }
  }, [applyAutoZoom]);

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

    setStatusMessage('Referencia frissitese...');
    try {
      const frameBlob = await captureVideoFrame(videoRef.current);
      await setReferenceImage(frameBlob);
      referenceFrameRef.current = frameBlob;
      setLastDetectedDarts(0);
      setStatusMessage('Referencia OK!');
      setTimeout(() => setStatusMessage(null), 1500);
    } catch {
      setError('Referencia frissites sikertelen');
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.3, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.3, 1));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
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

          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.scale(zoomLevel, zoomLevel);
          ctx.translate(-canvas.width / 2 + panOffset.x, -canvas.height / 2 + panOffset.y);
          ctx.drawImage(video, 0, 0);

          if (calibrationRef.current && calibrationRef.current.success) {
            const cal = calibrationRef.current;
            const { center_x, center_y, radius, ellipse, is_angled } = cal;
            const radiusX = cal.radius_x || radius;
            const radiusY = cal.radius_y || radius;

            if (center_x && center_y && radius) {
              const bullX = ellipse ? ellipse.center_x : center_x;
              const bullY = ellipse ? ellipse.center_y : center_y;
              const drawRadiusX = ellipse ? ellipse.axis_major / 2 : radiusX;
              const drawRadiusY = ellipse ? ellipse.axis_minor / 2 : radiusY;
              const angle = ellipse ? ellipse.angle : 0;

              ctx.save();
              ctx.translate(bullX, bullY);
              ctx.rotate((angle * Math.PI) / 180);

              ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
              ctx.lineWidth = 3;
              ctx.setLineDash([10, 5]);
              ctx.beginPath();
              ctx.ellipse(0, 0, drawRadiusX, drawRadiusY, 0, 0, Math.PI * 2);
              ctx.stroke();

              ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
              ctx.lineWidth = 1;
              ctx.setLineDash([5, 5]);
              ctx.beginPath();
              ctx.ellipse(0, 0, drawRadiusX * 0.63, drawRadiusY * 0.63, 0, 0, Math.PI * 2);
              ctx.stroke();

              ctx.beginPath();
              ctx.ellipse(0, 0, drawRadiusX * 0.08, drawRadiusY * 0.08, 0, 0, Math.PI * 2);
              ctx.stroke();

              ctx.setLineDash([]);

              ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(-25, 0);
              ctx.lineTo(25, 0);
              ctx.moveTo(0, -25);
              ctx.lineTo(0, 25);
              ctx.stroke();

              ctx.restore();

              ctx.fillStyle = 'rgba(34, 197, 94, 1)';
              ctx.shadowColor = 'rgba(34, 197, 94, 0.8)';
              ctx.shadowBlur = 12;
              ctx.beginPath();
              ctx.arc(bullX, bullY, 6, 0, Math.PI * 2);
              ctx.fill();
              ctx.shadowBlur = 0;

              ctx.fillStyle = '#fff';
              ctx.beginPath();
              ctx.arc(bullX, bullY, 2, 0, Math.PI * 2);
              ctx.fill();

              if (is_angled) {
                ctx.save();
                ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText('Szogbol', bullX + drawRadiusX + 10, bullY);
                ctx.restore();
              }
            }
          }

          ctx.restore();

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
  }, [isActive, isDetecting, zoomLevel, panOffset]);

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
                  <span className="text-green-400 text-sm font-medium">Szerver kapcsolat aktiv</span>
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

            <div className="relative mb-6">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-dark-700 to-dark-800 border-2 border-dark-600 flex items-center justify-center">
                <Camera className="w-10 h-10 text-dark-400" />
              </div>
            </div>

            <h3 className="text-lg font-semibold text-white mb-2">Automatikus Felismeres</h3>
            <p className="text-dark-400 mb-6 max-w-sm">
              Iranyitsd a kamerat a darttablara. A rendszer automatikusan felismeri a dobasokat.
            </p>

            <Button
              onClick={startCamera}
              disabled={isConnecting || !apiConnected}
              size="lg"
              className="px-8 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-500/25"
              leftIcon={isConnecting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            >
              {isConnecting ? 'Csatlakozas...' : 'Kamera Inditas'}
            </Button>
          </div>
        ) : (
          <div className={`relative ${isFullscreen ? 'h-full flex items-center justify-center bg-black' : ''}`}>
            <canvas
              ref={canvasRef}
              className={`${isFullscreen ? 'max-h-full max-w-full object-contain' : 'w-full'}`}
              style={!isFullscreen ? { aspectRatio: '16/9', objectFit: 'contain' } : undefined}
            />

            <div className="absolute top-3 left-3 flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm ${
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
                    <span className="text-amber-400 text-xs font-medium">Kalibralas...</span>
                  </>
                )}
              </div>

              {isDetecting && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/40 backdrop-blur-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-blue-400 text-xs font-medium">Figyeles</span>
                </div>
              )}
            </div>

            <div className="absolute top-3 right-3 flex gap-1.5">
              {showSettings && (
                <div className="absolute top-12 right-0 bg-dark-800 border border-dark-600 rounded-lg p-3 shadow-xl min-w-[200px] z-10">
                  <label className="flex items-center gap-2 text-sm text-dark-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoZoom}
                      onChange={(e) => setAutoZoom(e.target.checked)}
                      className="w-4 h-4 rounded bg-dark-700 border-dark-600"
                    />
                    Auto-zoom tablara
                  </label>
                </div>
              )}

              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white transition-colors"
                title="Beallitasok"
              >
                <Settings2 className="w-4 h-4" />
              </button>

              <button
                onClick={handleZoomOut}
                disabled={zoomLevel <= 1}
                className="p-2 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white transition-colors disabled:opacity-40"
                title="Kicsinyites"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <button
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                className="p-2 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white transition-colors disabled:opacity-40"
                title="Nagyitas"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              {zoomLevel > 1 && (
                <button
                  onClick={handleResetZoom}
                  className="p-2 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white transition-colors"
                  title="Zoom visszaallitas"
                >
                  <span className="text-xs font-medium">1x</span>
                </button>
              )}

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
                  onClick={runAutoCalibration}
                  disabled={isCalibrating}
                  className="p-2.5 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white transition-colors disabled:opacity-40"
                  title="Tabla ujrafelismerese"
                >
                  <Crosshair className="w-5 h-5" />
                </button>

                <button
                  onClick={resetReference}
                  className="p-2.5 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white transition-colors"
                  title="Referencia frissites"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={stopCamera}
                className="p-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm border border-red-500/40 text-red-400 hover:text-red-300 transition-colors"
                title="Kamera leallitas"
              >
                <CameraOff className="w-5 h-5" />
              </button>
            </div>

            {isCalibrating && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/30 rounded-full blur-xl animate-pulse" />
                  <div className="relative w-20 h-20 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin" />
                </div>
                <p className="text-blue-300 font-medium mt-4">Tabla automatikus felismerese...</p>
                <p className="text-dark-400 text-sm mt-1">Varj, amig a rendszer megtalaja a tablat</p>
              </div>
            )}

            {zoomLevel > 1 && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
                <span className="text-white/70 text-xs font-medium">{zoomLevel.toFixed(1)}x zoom</span>
              </div>
            )}
          </div>
        )}
      </div>

      {!isFullscreen && (
        <>
          {error && !isCalibrated && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1">
                <p className="text-red-300 font-medium">{error}</p>
                {isActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={runAutoCalibration}
                    className="mt-3 border-red-500/30 text-red-300 hover:bg-red-500/10"
                  >
                    Ujra probalom
                  </Button>
                )}
              </div>
            </div>
          )}

          {statusMessage && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-blue-300 font-medium">{statusMessage}</p>
            </div>
          )}

          {pendingScore && (
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-2xl font-bold text-amber-300">{pendingScore.score}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1.5 w-24 bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                        style={{ width: `${pendingScore.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-amber-400/70 text-sm">
                      {(pendingScore.confidence * 100).toFixed(0)}% biztossag
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

          {isActive && isCalibrated && !pendingScore && (
            <div className="flex items-center justify-between px-4 py-3 bg-dark-800/50 rounded-xl border border-dark-700">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping opacity-50" />
                </div>
                <span className="text-dark-300 text-sm font-medium">
                  Automatikus felismeres aktiv
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-dark-500 text-sm">{remainingDarts} nyil hatra</span>
              </div>
            </div>
          )}
        </>
      )}

      {isFullscreen && pendingScore && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-dark-800 border border-dark-600 rounded-xl p-4 shadow-2xl w-80">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xl font-bold text-amber-300">{pendingScore.score}</p>
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
    </div>
  );
}
