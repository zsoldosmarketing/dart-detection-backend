import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  Settings,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Crosshair,
  Volume2,
  Cloud,
  CloudOff,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { CameraManager } from '../../lib/cameraManager';
import {
  VisionDetectionEngine,
  type CalibrationData,
  type DetectionResult,
  type DetectionConfig,
  formatTarget,
} from '../../lib/visionDetection';
import { CameraCalibration } from './CameraCalibration';
import { DetectionCorrectionModal } from './DetectionCorrectionModal';
import type { DartTarget } from '../../lib/dartsEngine';
import {
  getApiUrl,
  setApiUrl,
  checkApiHealth,
  calibrateApi,
  setReferenceImage,
  detectDart as detectDartApi,
  parseScoreToTarget,
  captureVideoFrame,
  autoCalibrate,
} from '../../lib/dartDetectionApi';

interface CameraDetectionInputProps {
  onThrow: (target: DartTarget) => void;
  disabled?: boolean;
  remainingDarts?: number;
  voiceEnabled?: boolean;
}

type DetectionMode = 'assist' | 'auto';
type DetectionBackend = 'local' | 'api';

const CALIBRATION_STORAGE_KEY = 'dart-camera-calibration';
const DETECTION_CONFIG_KEY = 'dart-detection-config';

interface PendingApiDetection {
  target: DartTarget;
  confidence: number;
  score: string;
}

export function CameraDetectionInput({
  onThrow,
  disabled = false,
  remainingDarts = 3,
  voiceEnabled = false,
}: CameraDetectionInputProps) {
  const [isActive, setIsActive] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  const [calibration, setCalibration] = useState<CalibrationData | null>(null);
  const [lastDetection, setLastDetection] = useState<DetectionResult | null>(null);
  const [pendingDetection, setPendingDetection] = useState<DetectionResult | null>(null);
  const [pendingApiDetection, setPendingApiDetection] = useState<PendingApiDetection | null>(null);
  const [detectionMode, setDetectionMode] = useState<DetectionMode>('assist');
  const [detectionBackend, setDetectionBackend] = useState<DetectionBackend>('local');
  const [apiUrl, setApiUrlState] = useState(getApiUrl());
  const [apiConnected, setApiConnected] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<DetectionConfig>({
    burstCount: 3,
    burstDelayMs: 50,
    minConfidence: 0.6,
    colorSensitivity: 30,
    brightnessThreshold: 25,
    minBlobSize: 50,
    maxBlobSize: 5000,
    debugMode: false,
  });
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isAutoCalibrating, setIsAutoCalibrating] = useState(false);
  const [autoCalibrationMessage, setAutoCalibrationMessage] = useState<string | null>(null);
  const previousFrameRef = useRef<Blob | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<CameraManager | null>(null);
  const engineRef = useRef<VisionDetectionEngine | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const savedCalibration = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (savedCalibration) {
      try {
        setCalibration(JSON.parse(savedCalibration));
      } catch {
        localStorage.removeItem(CALIBRATION_STORAGE_KEY);
      }
    }

    const savedConfig = localStorage.getItem(DETECTION_CONFIG_KEY);
    if (savedConfig) {
      try {
        setConfig(prev => ({ ...prev, ...JSON.parse(savedConfig) }));
      } catch {
        localStorage.removeItem(DETECTION_CONFIG_KEY);
      }
    }

    const url = getApiUrl();
    if (url) {
      setApiUrlState(url);
      checkApiHealth().then(health => {
        if (health) {
          setApiConnected(true);
          setDetectionBackend('api');
        }
      });
    }

    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;

    setError(null);
    setIsReconnecting(false);

    const camera = new CameraManager();
    camera.setCallbacks({
      onDisconnect: () => {
        setIsReconnecting(true);
        setError('Kamera kapcsolat megszakadt, ujracsatlakozas...');
      },
      onReconnect: () => {
        setIsReconnecting(false);
        setError(null);
        if (videoRef.current && engineRef.current) {
          setTimeout(() => {
            const frame = engineRef.current!.captureFrame(videoRef.current!);
            engineRef.current!.setBaselineFrame(frame);
          }, 500);
        }
      },
      onError: (err) => {
        setIsReconnecting(false);
        setError(err.message);
      },
    });
    cameraRef.current = camera;

    const success = await camera.start(videoRef.current);
    if (!success) {
      setError('Nem sikerult elinditani a kamerat');
      return;
    }

    const engine = new VisionDetectionEngine(config);
    if (calibration) {
      engine.setCalibration(calibration);
    }
    if (config.debugMode && debugCanvasRef.current) {
      engine.setDebugCanvas(debugCanvasRef.current);
    }
    engineRef.current = engine;

    setTimeout(() => {
      if (videoRef.current && engineRef.current) {
        const frame = engineRef.current.captureFrame(videoRef.current);
        engineRef.current.setBaselineFrame(frame);
      }
    }, 500);

    setIsActive(true);
  }, [calibration, config]);

  const stopCamera = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    engineRef.current = null;
    setIsActive(false);
    setIsDetecting(false);
  }, []);

  const captureBaseline = useCallback(() => {
    if (!videoRef.current || !engineRef.current) return;
    const frame = engineRef.current.captureFrame(videoRef.current);
    engineRef.current.setBaselineFrame(frame);
    setLastDetection(null);
    setPendingDetection(null);
  }, []);

  const detectDartLocal = useCallback(async () => {
    if (!videoRef.current || !engineRef.current) return;

    const result = await engineRef.current.detectWithBurst(videoRef.current);

    if (result && result.confidence >= config.minConfidence) {
      setLastDetection(result);

      if (detectionMode === 'auto' && result.confidence >= 0.8) {
        onThrow(result.target);
        captureBaseline();
      } else {
        setPendingDetection(result);
      }
    }
  }, [config.minConfidence, detectionMode, onThrow, captureBaseline]);

  const detectDartRemote = useCallback(async () => {
    if (!videoRef.current) return;

    const frameBlob = await captureVideoFrame(videoRef.current);
    const result = await detectDartApi(frameBlob);

    if (result && result.confidence >= config.minConfidence) {
      const target = parseScoreToTarget(result.score);

      if (detectionMode === 'auto' && result.confidence >= 0.8) {
        onThrow(target);
        previousFrameRef.current = frameBlob;
      } else {
        setPendingApiDetection({
          target,
          confidence: result.confidence,
          score: result.score,
        });
      }
    } else if (result) {
      setPendingApiDetection({
        target: parseScoreToTarget(result.score),
        confidence: result.confidence,
        score: result.score,
      });
    }

    previousFrameRef.current = frameBlob;
  }, [config.minConfidence, detectionMode, onThrow]);

  const detectDart = useCallback(async () => {
    if (!videoRef.current || isDetecting || disabled || isReconnecting) return;
    if (detectionBackend === 'local' && !engineRef.current) return;

    setIsDetecting(true);
    setError(null);

    try {
      if (detectionBackend === 'api' && apiConnected) {
        await detectDartRemote();
      } else {
        await detectDartLocal();
      }
    } catch (err) {
      console.error('Detection error:', err);
      setError('Felismeres sikertelen');
    } finally {
      setIsDetecting(false);
    }
  }, [isDetecting, disabled, isReconnecting, detectionBackend, apiConnected, detectDartRemote, detectDartLocal]);

  const confirmDetection = useCallback(() => {
    if (pendingDetection) {
      onThrow(pendingDetection.target);
      setPendingDetection(null);
      captureBaseline();
    } else if (pendingApiDetection) {
      onThrow(pendingApiDetection.target);
      setPendingApiDetection(null);
    }
  }, [pendingDetection, pendingApiDetection, onThrow, captureBaseline]);

  const rejectDetection = useCallback(() => {
    setPendingDetection(null);
    setPendingApiDetection(null);
    setShowCorrection(true);
  }, []);

  const handleCorrectionSubmit = useCallback((target: DartTarget) => {
    onThrow(target);
    setShowCorrection(false);
    setPendingDetection(null);
    setPendingApiDetection(null);
    captureBaseline();
  }, [onThrow, captureBaseline]);

  const handleApiUrlChange = useCallback(async (url: string) => {
    setApiUrl(url);
    setApiUrlState(url);
    if (url) {
      const health = await checkApiHealth();
      setApiConnected(!!health);
      if (health) {
        setDetectionBackend('api');
      }
    } else {
      setApiConnected(false);
      setDetectionBackend('local');
    }
  }, []);

  const handleSetReference = useCallback(async () => {
    if (!videoRef.current || !apiConnected) return;
    try {
      const frameBlob = await captureVideoFrame(videoRef.current);
      const success = await setReferenceImage(frameBlob);
      if (success) {
        previousFrameRef.current = frameBlob;
        setError(null);
      } else {
        setError('Referencia kep beallitasa sikertelen');
      }
    } catch {
      setError('Referencia kep beallitasa sikertelen');
    }
  }, [apiConnected]);

  const handleCalibrateApi = useCallback(async () => {
    if (!calibration || !apiConnected) return;
    try {
      const success = await calibrateApi({
        center_x: Math.round(calibration.boardCenter.x),
        center_y: Math.round(calibration.boardCenter.y),
        radius: Math.round(calibration.boardRadius),
      });
      if (!success) {
        setError('API kalibralas sikertelen');
      }
    } catch {
      setError('API kalibralas sikertelen');
    }
  }, [calibration, apiConnected]);

  const handleAutoCalibrate = useCallback(async () => {
    if (!videoRef.current || !apiConnected) return;

    setIsAutoCalibrating(true);
    setAutoCalibrationMessage(null);
    setError(null);

    try {
      const frameBlob = await captureVideoFrame(videoRef.current);
      const result = await autoCalibrate(frameBlob);

      if (result && result.success) {
        const newCalibration: CalibrationData = {
          points: [],
          boardCenter: { x: result.center_x!, y: result.center_y! },
          boardRadius: result.radius!,
          homographyMatrix: null,
          timestamp: Date.now(),
        };

        setCalibration(newCalibration);
        localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(newCalibration));

        if (engineRef.current) {
          engineRef.current.setCalibration(newCalibration);
        }

        setAutoCalibrationMessage(`Tabla automatikusan felismerve! (${(result.confidence * 100).toFixed(0)}%)`);

        await setReferenceImage(frameBlob);
        previousFrameRef.current = frameBlob;
      } else {
        setError(result?.message || 'Automatikus kalibralas sikertelen');
      }
    } catch {
      setError('Automatikus kalibralas sikertelen');
    } finally {
      setIsAutoCalibrating(false);
    }
  }, [apiConnected]);

  const handleCalibrationComplete = useCallback((newCalibration: CalibrationData) => {
    setCalibration(newCalibration);
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(newCalibration));
    setShowCalibration(false);

    if (engineRef.current) {
      engineRef.current.setCalibration(newCalibration);
    }
  }, []);

  const updateConfig = useCallback((updates: Partial<DetectionConfig>) => {
    setConfig(prev => {
      const newConfig = { ...prev, ...updates };
      localStorage.setItem(DETECTION_CONFIG_KEY, JSON.stringify(newConfig));
      if (engineRef.current) {
        engineRef.current.setConfig(newConfig);
      }
      return newConfig;
    });
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

          if (calibration) {
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(
              calibration.boardCenter.x,
              calibration.boardCenter.y,
              calibration.boardRadius,
              0,
              Math.PI * 2
            );
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
            ctx.beginPath();
            ctx.arc(
              calibration.boardCenter.x,
              calibration.boardCenter.y,
              6,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }

          if (lastDetection) {
            const { tipPosition, target, confidence } = lastDetection;
            ctx.strokeStyle = confidence >= 0.8 ? '#22c55e' : '#f59e0b';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(tipPosition.x, tipPosition.y, 15, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(
              `${formatTarget(target)} (${(confidence * 100).toFixed(0)}%)`,
              tipPosition.x,
              tipPosition.y - 25
            );
          }
        }
        animationId = requestAnimationFrame(draw);
      };

      draw();
      return () => cancelAnimationFrame(animationId);
    }
  }, [isActive, calibration, lastDetection]);

  if (showCalibration) {
    return (
      <CameraCalibration
        onCalibrationComplete={handleCalibrationComplete}
        onCancel={() => setShowCalibration(false)}
        existingCalibration={calibration}
      />
    );
  }

  return (
    <div className="space-y-3">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute opacity-0 pointer-events-none w-0 h-0"
      />

      <div className="relative bg-gray-900 rounded-lg overflow-hidden">
        {!isActive ? (
          <div className="aspect-video flex flex-col items-center justify-center p-6 text-center">
            <Camera className="w-12 h-12 text-gray-600 mb-4" />
            <p className="text-gray-400 mb-4">
              {calibration
                ? 'Kamera keszenletben. Nyomd meg a Start gombot.'
                : 'Eloszor kalibrald a kamerat.'}
            </p>
            <div className="flex gap-2">
              {!calibration && (
                <Button onClick={() => setShowCalibration(true)}>
                  <Crosshair className="w-4 h-4 mr-2" />
                  Kalibralas
                </Button>
              )}
              {calibration && (
                <Button onClick={startCamera}>
                  <Camera className="w-4 h-4 mr-2" />
                  Kamera Inditas
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <canvas ref={canvasRef} className="w-full" style={{ maxHeight: '300px' }} />

            {config.debugMode && (
              <canvas
                ref={debugCanvasRef}
                className="absolute top-0 right-0 w-32 h-24 border border-gray-700"
              />
            )}

            <div className="absolute top-2 right-2 flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(true)}
                className="bg-black/50 hover:bg-black/70"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCalibration(true)}
                className="bg-black/50 hover:bg-black/70"
              >
                <Crosshair className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={stopCamera}
                className="bg-black/50 hover:bg-black/70"
              >
                <CameraOff className="w-4 h-4" />
              </Button>
            </div>

            {isDetecting && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-white animate-spin" />
              </div>
            )}

            {isReconnecting && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mb-3" />
                <p className="text-amber-300 font-medium">Ujracsatlakozas...</p>
                <p className="text-gray-400 text-sm mt-1">A kamera kapcsolat megszakadt</p>
              </div>
            )}

            {isAutoCalibrating && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mb-3" />
                <p className="text-blue-300 font-medium">Tabla felismerese...</p>
                <p className="text-gray-400 text-sm mt-1">Keresem a darttablat</p>
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {autoCalibrationMessage && (
        <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 flex items-center gap-2">
          <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
          <p className="text-green-300 text-sm">{autoCalibrationMessage}</p>
        </div>
      )}

      {isActive && apiConnected && !calibration && (
        <Button
          onClick={handleAutoCalibrate}
          disabled={isAutoCalibrating}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {isAutoCalibrating ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Tabla felismerese...
            </>
          ) : (
            <>
              <Crosshair className="w-4 h-4 mr-2" />
              Tabla Automatikus Felismerese
            </>
          )}
        </Button>
      )}

      {isActive && apiConnected && calibration && !pendingDetection && !pendingApiDetection && (
        <Button
          onClick={handleAutoCalibrate}
          disabled={isAutoCalibrating}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Crosshair className="w-4 h-4 mr-2" />
          Tabla Ujrafelismerese
        </Button>
      )}

      {(pendingDetection || pendingApiDetection) && (
        <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-amber-300 font-medium">
                Eszlelt: {pendingDetection
                  ? formatTarget(pendingDetection.target)
                  : pendingApiDetection?.score || ''}
              </p>
              <p className="text-amber-300/70 text-sm">
                Biztossag: {((pendingDetection?.confidence || pendingApiDetection?.confidence || 0) * 100).toFixed(0)}%
              </p>
            </div>
            {voiceEnabled && (
              <Volume2 className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={confirmDetection}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Check className="w-4 h-4 mr-2" />
              Elfogad
            </Button>
            <Button
              variant="outline"
              onClick={rejectDetection}
              className="flex-1"
            >
              <X className="w-4 h-4 mr-2" />
              Javitas
            </Button>
          </div>
        </div>
      )}

      {isActive && !pendingDetection && !pendingApiDetection && (
        <div className="flex gap-2">
          <Button
            onClick={detectDart}
            disabled={disabled || isDetecting || remainingDarts <= 0}
            className="flex-1"
          >
            {isDetecting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Felismeres...
              </>
            ) : (
              <>
                <Camera className="w-4 h-4 mr-2" />
                Nyil Felismerese ({remainingDarts} hatra)
              </>
            )}
          </Button>
          {detectionBackend === 'api' && apiConnected ? (
            <Button variant="outline" onClick={handleSetReference} title="Referencia kep">
              <RefreshCw className="w-4 h-4" />
            </Button>
          ) : (
            <Button variant="outline" onClick={captureBaseline}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Mod:</span>
            <button
              onClick={() => setDetectionMode(detectionMode === 'assist' ? 'auto' : 'assist')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                detectionMode === 'assist'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-green-500/20 text-green-400'
              }`}
            >
              {detectionMode === 'assist' ? 'Segitett' : 'Automatikus'}
            </button>
          </div>
          <div className="flex items-center gap-1">
            {apiConnected ? (
              <Cloud className="w-4 h-4 text-green-400" />
            ) : (
              <CloudOff className="w-4 h-4 text-gray-500" />
            )}
            <span className={`text-xs ${apiConnected ? 'text-green-400' : 'text-gray-500'}`}>
              {detectionBackend === 'api' ? 'API' : 'Local'}
            </span>
          </div>
        </div>
        <div className="text-gray-500 text-xs">
          {lastDetection && `Utolso: ${lastDetection.detectionTimeMs.toFixed(0)}ms`}
        </div>
      </div>

      {showSettings && (
        <DetectionSettingsModal
          config={config}
          onUpdate={updateConfig}
          onClose={() => setShowSettings(false)}
          apiUrl={apiUrl}
          onApiUrlChange={handleApiUrlChange}
          apiConnected={apiConnected}
          detectionBackend={detectionBackend}
          onBackendChange={setDetectionBackend}
          onCalibrateApi={handleCalibrateApi}
          hasCalibration={!!calibration}
        />
      )}

      {showCorrection && (
        <DetectionCorrectionModal
          lastDetection={pendingDetection}
          onSubmit={handleCorrectionSubmit}
          onCancel={() => {
            setShowCorrection(false);
            setPendingDetection(null);
          }}
        />
      )}
    </div>
  );
}

interface DetectionSettingsModalProps {
  config: DetectionConfig;
  onUpdate: (updates: Partial<DetectionConfig>) => void;
  onClose: () => void;
  apiUrl: string;
  onApiUrlChange: (url: string) => void;
  apiConnected: boolean;
  detectionBackend: DetectionBackend;
  onBackendChange: (backend: DetectionBackend) => void;
  onCalibrateApi: () => void;
  hasCalibration: boolean;
}

function DetectionSettingsModal({
  config,
  onUpdate,
  onClose,
  apiUrl,
  onApiUrlChange,
  apiConnected,
  detectionBackend,
  onBackendChange,
  onCalibrateApi,
  hasCalibration,
}: DetectionSettingsModalProps) {
  const [tempApiUrl, setTempApiUrl] = useState(apiUrl);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Felismeres Beallitasok</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3 flex items-center gap-2">
              <Cloud className="w-4 h-4" />
              OpenCV API Backend
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  API URL (pl. https://your-app.onrender.com)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempApiUrl}
                    onChange={e => setTempApiUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={() => onApiUrlChange(tempApiUrl)}
                  >
                    Mentes
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Allapot:</span>
                <span className={`text-sm font-medium ${apiConnected ? 'text-green-400' : 'text-red-400'}`}>
                  {apiConnected ? 'Csatlakozva' : 'Nincs kapcsolat'}
                </span>
              </div>
              {apiConnected && hasCalibration && (
                <Button size="sm" variant="outline" onClick={onCalibrateApi} className="w-full">
                  Kalibralas kuldese az API-nak
                </Button>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                <span className="text-gray-400 text-sm">Backend:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onBackendChange('local')}
                    className={`px-3 py-1 rounded text-sm ${
                      detectionBackend === 'local'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    Local
                  </button>
                  <button
                    onClick={() => onBackendChange('api')}
                    disabled={!apiConnected}
                    className={`px-3 py-1 rounded text-sm ${
                      detectionBackend === 'api'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-700 text-gray-400'
                    } ${!apiConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    API
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">
              Minimum Biztossag: {(config.minConfidence * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="30"
              max="90"
              value={config.minConfidence * 100}
              onChange={e => onUpdate({ minConfidence: Number(e.target.value) / 100 })}
              className="w-full"
            />
          </div>

          {detectionBackend === 'local' && (
            <>
              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Fenyerzekenyseg: {config.brightnessThreshold}
                </label>
                <input
                  type="range"
                  min="10"
                  max="60"
                  value={config.brightnessThreshold}
                  onChange={e => onUpdate({ brightnessThreshold: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Szin Erzekenyseg: {config.colorSensitivity}
                </label>
                <input
                  type="range"
                  min="10"
                  max="60"
                  value={config.colorSensitivity}
                  onChange={e => onUpdate({ colorSensitivity: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Burst Kepek Szama: {config.burstCount}
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={config.burstCount}
                  onChange={e => onUpdate({ burstCount: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Debug Mod</span>
                <button
                  onClick={() => onUpdate({ debugMode: !config.debugMode })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    config.debugMode ? 'bg-blue-500' : 'bg-gray-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      config.debugMode ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </>
          )}
        </div>

        <Button onClick={onClose} className="w-full mt-6">
          Bezaras
        </Button>
      </div>
    </div>
  );
}
