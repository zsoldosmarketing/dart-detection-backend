import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  X,
  Smartphone,
  Monitor,
  Wifi,
  WifiOff,
  Loader2,
  SwitchCamera,
  Share2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { CameraManager, type CameraDevice } from '../../lib/cameraManager';
import { RemoteCameraProvider } from '../../lib/remoteCameraSharing';
import { useAuthStore } from '../../stores/authStore';

interface RemoteCameraShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ShareStatus = 'idle' | 'starting' | 'sharing' | 'connected' | 'error';

export function RemoteCameraShareModal({ isOpen, onClose }: RemoteCameraShareModalProps) {
  const { user } = useAuthStore();
  const [status, setStatus] = useState<ShareStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);
  const [currentCameraLabel, setCurrentCameraLabel] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<CameraManager | null>(null);
  const providerRef = useRef<RemoteCameraProvider | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.stopSharing();
      providerRef.current = null;
    }
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    streamRef.current = null;
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      cleanup();
    }
  }, [isOpen, cleanup]);

  const startSharing = async (cameraIndex?: number) => {
    if (!user) {
      setErrorMessage('Be kell jelentkezned a kamera megosztashoz');
      setStatus('error');
      return;
    }

    setStatus('starting');
    setErrorMessage(null);

    try {
      const granted = await CameraManager.requestPermission();
      if (!granted) {
        setErrorMessage('Kamera hozzaferes megtagadva');
        setStatus('error');
        return;
      }

      const tempCamera = new CameraManager();
      const deviceList = await tempCamera.listDevices();
      setCameras(deviceList);

      if (deviceList.length === 0) {
        setErrorMessage('Nem talalhato kamera');
        setStatus('error');
        return;
      }

      const indexToUse = cameraIndex ?? findBackCameraIndex(deviceList);
      setSelectedCameraIndex(indexToUse);

      const selectedCamera = deviceList[indexToUse];
      setCurrentCameraLabel(selectedCamera.label || `Kamera ${indexToUse + 1}`);

      const camera = new CameraManager({ deviceId: selectedCamera.deviceId });
      cameraRef.current = camera;

      if (!videoRef.current) {
        setErrorMessage('Video elem nem talalhato');
        setStatus('error');
        return;
      }

      const success = await camera.start(videoRef.current);
      if (!success) {
        setErrorMessage('Nem sikerult elinditani a kamerat');
        setStatus('error');
        return;
      }

      streamRef.current = camera.getStream();

      if (!streamRef.current) {
        setErrorMessage('Nem sikerult lekerni a video streamet');
        setStatus('error');
        return;
      }

      providerRef.current = new RemoteCameraProvider({
        onStatusChange: (newStatus) => {
          if (newStatus === 'connected') {
            setStatus('connected');
          } else if (newStatus === 'disconnected') {
            setStatus('sharing');
          }
        },
        onError: (err) => {
          setErrorMessage(err);
          setStatus('error');
        },
      });

      const sessionId = await providerRef.current.startSharing(streamRef.current);
      if (!sessionId) {
        setErrorMessage('Nem sikerult letrehozni a megosztast');
        setStatus('error');
        return;
      }

      setStatus('sharing');
    } catch (err) {
      setErrorMessage(`Hiba: ${err}`);
      setStatus('error');
    }
  };

  const findBackCameraIndex = (deviceList: CameraDevice[]): number => {
    const backIndex = deviceList.findIndex(d =>
      d.label.toLowerCase().includes('back') ||
      d.label.toLowerCase().includes('hatul') ||
      d.label.toLowerCase().includes('rear') ||
      d.label.toLowerCase().includes('environment')
    );
    return backIndex >= 0 ? backIndex : 0;
  };

  const switchCamera = async () => {
    if (cameras.length <= 1) return;

    const nextIndex = (selectedCameraIndex + 1) % cameras.length;

    if (providerRef.current) {
      providerRef.current.stopSharing();
      providerRef.current = null;
    }
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    streamRef.current = null;

    await startSharing(nextIndex);
  };

  useEffect(() => {
    if (isOpen && status === 'idle') {
      requestAnimationFrame(() => {
        startSharing();
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-dark-800 rounded-xl border border-dark-700 shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-4 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Share2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Kamera Megosztasa</h2>
              <p className="text-sm text-dark-400">Mas eszkozodon hasznalhatod</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors text-dark-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className={`relative aspect-video bg-black rounded-lg overflow-hidden ${
            status === 'sharing' || status === 'connected' ? 'mb-4' : 'h-0 overflow-hidden opacity-0 absolute'
          }`}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2 flex items-center gap-2 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm z-10">
              {status === 'connected' ? (
                <>
                  <Wifi className="w-3 h-3 text-green-400" />
                  <span className="text-green-400 text-xs font-medium">Kapcsolodva</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400 text-xs font-medium">Aktiv</span>
                </>
              )}
            </div>
            {cameras.length > 1 && (
              <button
                onClick={switchCamera}
                className="absolute top-2 right-2 p-2 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white transition-colors z-10"
                title="Kamera valtas"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            )}
          </div>


          {status === 'starting' && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-400 animate-spin" />
              <p className="text-white">Kamera inditasa...</p>
              <p className="text-dark-400 text-sm mt-2">Engedelyezd a bongeszodben</p>
            </div>
          )}

          {(status === 'sharing' || status === 'connected') && (
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400 font-medium">Kamera Megosztva</span>
                </div>
                <p className="text-dark-300 text-sm">
                  {currentCameraLabel}
                </p>
              </div>

              <div className="bg-dark-700/50 rounded-lg p-4">
                <div className="flex items-center justify-center gap-8 mb-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-full bg-green-500/20">
                      <Smartphone className="w-6 h-6 text-green-400" />
                    </div>
                    <span className="text-xs text-dark-400">Ez az eszkoz</span>
                  </div>
                  <div className="flex items-center gap-1 text-dark-500">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <div className="w-8 h-0.5 bg-green-400/50" />
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-full bg-blue-500/20">
                      <Monitor className="w-6 h-6 text-blue-400" />
                    </div>
                    <span className="text-xs text-dark-400">Masik eszkoz</span>
                  </div>
                </div>
                <p className="text-dark-400 text-sm text-center">
                  {status === 'connected'
                    ? 'Masik eszkoz kapcsolodott!'
                    : 'A masik eszkozon valaszd ki a "Tavoli kamera" opciot'}
                </p>
              </div>

              <Button variant="secondary" onClick={cleanup} className="w-full">
                <WifiOff className="w-4 h-4 mr-2" />
                Megosztas Leallitasa
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <X className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Hiba tortent</h3>
              <p className="text-dark-400 text-sm mb-6">{errorMessage}</p>
              <Button onClick={() => startSharing()} variant="secondary" className="w-full">
                Ujraproba
              </Button>
            </div>
          )}

          {status === 'idle' && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-400 animate-spin" />
              <p className="text-white">Betoltes...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
