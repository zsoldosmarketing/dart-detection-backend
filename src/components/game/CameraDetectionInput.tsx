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
} from 'lucide-react';
import { Button } from '../ui/Button';
import { CameraManager } from '../../lib/cameraManager';
import type { DartTarget } from '../../lib/dartsEngine';
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
  const [debugImages, setDebugImages] = useState<{
    canonical?: string;
    diff?: string;
    mask?: string;
  }>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<CameraManager | null>(null);
  const boardDetectIntervalRef = useRef<number | null>(null);
  const referenceFrameRef = useRef<Blob | null>(null);
  const calibrationRef = useRef<AutoCalibrationResult | null>(null);
  const boardResultRef = useRef<BoardDetectResult | null>(null);
  const homographyRef = useRef<number[][] | null>(null);

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

  const runBoardDetection = useCallback(async () => {
    if (!videoRef.current || !apiConnected) return;

    try {
      const frameBlob = await captureVideoFrame(videoRef.current);
      const result = await detectBoard(frameBlob);

      if (result && result.board_found) {
        boardResultRef.current = result;
        homographyRef.current = result.homography;

        const cal = boardDetectToCalibration(result);
        calibrationRef.current = cal;

        if (!isCalibrated) {
          setIsCalibrated(true);
          referenceFrameRef.current = frameBlob;
          await setReferenceImage(frameBlob);
          setStatusMessage(`Tabla OK! (${(result.confidence * 100).toFixed(0)}%)`);
          setTimeout(() => setStatusMessage(null), 2000);
        }

        if (result.canonical_preview) {
          setDebugImages(prev => ({ ...prev, canonical: result.canonical_preview! }));
        }
      }
    } catch (err) {
      console.error('[Camera] Board detection error:', err);
    }
  }, [apiConnected, isCalibrated]);

  const startBoardDetectLoop = useCallback(() => {
    if (boardDetectIntervalRef.current) {
      clearInterval(boardDetectIntervalRef.current);
    }

    runBoardDetection();

    boardDetectIntervalRef.current = window.setInterval(() => {
      if (!pendingScore) {
        runBoardDetection();
      }
    }, BOARD_DETECT_INTERVAL);
  }, [runBoardDetection, pendingScore]);

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;

    setError(null);
    setIsConnecting(true);
    setStatusMessage('Kamera inditasa...');

    const camera = new CameraManager();
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

    await checkConnection(false);

    setTimeout(() => {
      startBoardDetectLoop();
    }, 500);
  }, [checkConnection, startBoardDetectLoop]);

  const stopCamera = useCallback(() => {
    if (boardDetectIntervalRef.current) {
      clearInterval(boardDetectIntervalRef.current);
      boardDetectIntervalRef.current = null;
    }
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    setIsActive(false);
    setIsDetecting(false);
    setIsCalibrated(false);
    setPendingScore(null);
    setDebugImages({});
    referenceFrameRef.current = null;
    calibrationRef.current = null;
    boardResultRef.current = null;
    homographyRef.current = null;
  }, []);

  const triggerThrowDetection = useCallback(async () => {
    if (!videoRef.current || !isCalibrated || !referenceFrameRef.current || isDetecting) return;

    setIsDetecting(true);
    setStatusMessage('Dobas feldolgozasa...');

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
          setStatusMessage(`${result.label} (${result.score} pont) - AUTO`);
          setTimeout(() => setStatusMessage(null), 2000);
        } else {
          setPendingScore(result);
        }
      } else {
        setError('Nem sikerult feldolgozni a dobast.');
      }
    } catch (err) {
      console.error('[Camera] Throw detection error:', err);
      setError('Hiba a dobas feldolgozasakor.');
    } finally {
      setIsDetecting(false);
    }
  }, [isCalibrated, isDetecting, onThrow]);

  const confirmPendingScore = useCallback(() => {
    if (pendingScore) {
      const target = parseScoreToTarget(pendingScore.label);
      onThrow(target);
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
  }, [isActive, isDetecting]);

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
              onClick={startCamera}
              disabled={isConnecting || !apiConnected}
              size="lg"
              className="px-8 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-500/25"
              leftIcon={isConnecting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            >
              {isConnecting ? 'Inditás...' : 'Kamera Inditas'}
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

                <button
                  onClick={stopCamera}
                  className="p-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm border border-red-500/40 text-red-400 hover:text-red-300 transition-colors"
                  title="Kamera leallitas"
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
    </div>
  );
}
