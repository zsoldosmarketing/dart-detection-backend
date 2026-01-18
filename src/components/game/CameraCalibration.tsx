import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CheckCircle, RotateCcw, X, Target, AlertCircle, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { CameraManager, type CameraDevice } from '../../lib/cameraManager';
import {
  VisionDetectionEngine,
  CALIBRATION_TARGETS,
  type CalibrationPoint,
  type CalibrationData,
} from '../../lib/visionDetection';

interface CameraCalibrationProps {
  onCalibrationComplete: (calibration: CalibrationData) => void;
  onCancel: () => void;
  existingCalibration?: CalibrationData | null;
}

type CalibrationStep = 'permission' | 'camera-select' | 'calibrating' | 'complete';

export function CameraCalibration({
  onCalibrationComplete,
  onCancel,
  existingCalibration,
}: CameraCalibrationProps) {
  const [step, setStep] = useState<CalibrationStep>('permission');
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [cameraReady, setCameraReady] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState<CalibrationPoint[]>([]);
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<CameraManager | null>(null);

  const currentTarget = CALIBRATION_TARGETS[currentTargetIndex];
  const progress = (calibrationPoints.length / CALIBRATION_TARGETS.length) * 100;

  useEffect(() => {
    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
    };
  }, []);

  const checkPermissionAndListDevices = useCallback(async () => {
    setError(null);
    const permission = await CameraManager.checkPermission();

    if (permission === 'denied') {
      setError('Kamera hozzaferes megtagadva. Kerlek engedelyezd a bongeszoed beallitasaiban.');
      return;
    }

    const granted = await CameraManager.requestPermission();
    if (!granted) {
      setError('Nem sikerult hozzaferni a kamerahoz.');
      return;
    }

    const camera = new CameraManager();
    const deviceList = await camera.listDevices();
    setDevices(deviceList);

    if (deviceList.length > 0) {
      setSelectedDevice(deviceList[0].deviceId);
      setStep('camera-select');
    } else {
      setError('Nem talalhato kamera.');
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (!videoRef.current || !selectedDevice) return;

    setError(null);
    setCameraReady(false);
    setIsReconnecting(false);

    const camera = new CameraManager({ deviceId: selectedDevice });
    camera.setCallbacks({
      onDisconnect: () => {
        setIsReconnecting(true);
        setError('Kamera kapcsolat megszakadt, ujracsatlakozas...');
      },
      onReconnect: () => {
        setIsReconnecting(false);
        setError(null);
      },
      onError: (err) => {
        setIsReconnecting(false);
        setError(err.message);
      },
    });
    cameraRef.current = camera;

    const success = await camera.start(videoRef.current);
    if (success) {
      setCameraReady(true);
      setStep('calibrating');
    } else {
      setError('Nem sikerult elinditani a kamerat.');
    }
  }, [selectedDevice]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !videoRef.current || !currentTarget) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = videoRef.current.videoWidth / rect.width;
    const scaleY = videoRef.current.videoHeight / rect.height;

    const screenX = (e.clientX - rect.left) * scaleX;
    const screenY = (e.clientY - rect.top) * scaleY;

    const newPoint: CalibrationPoint = {
      boardX: 0,
      boardY: 0,
      screenX,
      screenY,
      target: currentTarget.target,
    };

    setClickPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    setTimeout(() => {
      const newPoints = [...calibrationPoints, newPoint];
      setCalibrationPoints(newPoints);

      if (currentTargetIndex < CALIBRATION_TARGETS.length - 1) {
        setCurrentTargetIndex(currentTargetIndex + 1);
        setClickPosition(null);
      } else {
        completeCalibration(newPoints);
      }
    }, 300);
  }, [calibrationPoints, currentTarget, currentTargetIndex]);

  const completeCalibration = useCallback((points: CalibrationPoint[]) => {
    const calibrationData = VisionDetectionEngine.computeCalibrationFromPoints(points);

    const fullCalibration: CalibrationData = {
      points,
      boardCenter: calibrationData.boardCenter || { x: 0, y: 0 },
      boardRadius: calibrationData.boardRadius || 200,
      homographyMatrix: null,
      timestamp: Date.now(),
    };

    setStep('complete');

    setTimeout(() => {
      onCalibrationComplete(fullCalibration);
    }, 1500);
  }, [onCalibrationComplete]);

  const resetCalibration = useCallback(() => {
    setCalibrationPoints([]);
    setCurrentTargetIndex(0);
    setClickPosition(null);
  }, []);

  const skipToComplete = useCallback(() => {
    if (existingCalibration) {
      onCalibrationComplete(existingCalibration);
    }
  }, [existingCalibration, onCalibrationComplete]);

  useEffect(() => {
    if (step === 'calibrating' && cameraReady && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let animationId: number;

      const draw = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();

        for (const point of calibrationPoints) {
          const scaleX = canvas.width / video.videoWidth;
          const scaleY = canvas.height / video.videoHeight;
          const x = point.screenX * scaleX;
          const y = point.screenY * scaleY;

          ctx.fillStyle = '#22c55e';
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(point.target, x, y - 15);
        }

        if (clickPosition) {
          const scaleX = canvas.width / canvas.clientWidth;
          const scaleY = canvas.height / canvas.clientHeight;
          const x = clickPosition.x * scaleX;
          const y = clickPosition.y * scaleY;

          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y, 20, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x - 30, y);
          ctx.lineTo(x + 30, y);
          ctx.moveTo(x, y - 30);
          ctx.lineTo(x, y + 30);
          ctx.stroke();
        }

        animationId = requestAnimationFrame(draw);
      };

      draw();
      return () => cancelAnimationFrame(animationId);
    }
  }, [step, cameraReady, calibrationPoints, clickPosition]);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Camera className="w-6 h-6 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Kamera Kalibracra</h2>
        </div>
        <div className="flex items-center gap-2">
          {existingCalibration && step === 'calibrating' && (
            <Button variant="ghost" size="sm" onClick={skipToComplete}>
              Regebbi hasznalata
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {step === 'permission' && (
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Camera className="w-10 h-10 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">
              Kamera Hozzaferes Szukseges
            </h3>
            <p className="text-gray-400 mb-6">
              A nyil felismeresehez hozzaferunk a kamerahoz.
              Iranyitsd a kamerat a darts tablara.
            </p>
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}
            <Button onClick={checkPermissionAndListDevices} className="w-full">
              Kamera Engedelyezese
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === 'camera-select' && (
          <div className="text-center max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-6">
              Valaszd ki a kamerat
            </h3>
            <div className="space-y-2 mb-6">
              {devices.map(device => (
                <button
                  key={device.deviceId}
                  onClick={() => setSelectedDevice(device.deviceId)}
                  className={`w-full p-4 rounded-lg border transition-colors text-left ${
                    selectedDevice === device.deviceId
                      ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Camera className="w-5 h-5" />
                    <span className="truncate">{device.label}</span>
                  </div>
                </button>
              ))}
            </div>
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-4">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}
            <Button onClick={startCamera} className="w-full" disabled={!selectedDevice}>
              Kamera Inditasa
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute opacity-0 pointer-events-none w-0 h-0"
        />

        {step === 'calibrating' && (
          <div className="w-full max-w-4xl">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-amber-400" />
                  <span className="text-white font-medium">
                    {currentTarget?.label}
                  </span>
                </div>
                <span className="text-gray-400 text-sm">
                  {calibrationPoints.length + 1} / {CALIBRATION_TARGETS.length}
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-gray-400 text-sm mt-2">
                {currentTarget?.description}
              </p>
            </div>

            <div className="relative bg-black rounded-lg overflow-hidden">
              <canvas
                ref={canvasRef}
                onClick={isReconnecting ? undefined : handleCanvasClick}
                className={`w-full ${isReconnecting ? 'cursor-wait opacity-50' : 'cursor-crosshair'}`}
                style={{ maxHeight: '60vh' }}
              />
              {isReconnecting && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                  <RotateCcw className="w-8 h-8 text-amber-400 animate-spin mb-3" />
                  <p className="text-amber-300 font-medium">Ujracsatlakozas...</p>
                  <p className="text-gray-400 text-sm mt-1">A kamera kapcsolat megszakadt</p>
                </div>
              )}
            </div>

            {error && !isReconnecting && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mt-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div className="flex justify-center gap-3 mt-4">
              <Button
                variant="outline"
                onClick={resetCalibration}
                disabled={calibrationPoints.length === 0}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Ujrakezdes
              </Button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">
              Kalibracio Kesz!
            </h3>
            <p className="text-gray-400">
              A kamera sikeresen kalibrálva. Most mar hasznalhatod a nyil felismerest.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
