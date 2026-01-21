import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  X,
  Smartphone,
  Monitor,
  Wifi,
  WifiOff,
  Check,
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

type ShareStatus = 'idle' | 'requesting' | 'selecting' | 'sharing' | 'connected' | 'error';

export function RemoteCameraShareModal({ isOpen, onClose }: RemoteCameraShareModalProps) {
  const { user } = useAuthStore();
  const [status, setStatus] = useState<ShareStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);

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

  const requestCameraAccess = async () => {
    if (!user) {
      setErrorMessage('Be kell jelentkezned a kamera megosztashoz');
      setStatus('error');
      return;
    }

    setStatus('requesting');
    setErrorMessage(null);

    try {
      const granted = await CameraManager.requestPermission();
      if (!granted) {
        setErrorMessage('Kamera hozzaferes megtagadva');
        setStatus('error');
        return;
      }

      const camera = new CameraManager();
      const deviceList = await camera.listDevices();
      setCameras(deviceList);

      if (deviceList.length === 0) {
        setErrorMessage('Nem talalhato kamera');
        setStatus('error');
        return;
      }

      setStatus('selecting');
    } catch (err) {
      setErrorMessage(`Hiba: ${err}`);
      setStatus('error');
    }
  };

  const startSharing = async (cameraIndex: number) => {
    if (!videoRef.current || cameras.length === 0) return;

    setStatus('sharing');
    setSelectedCameraIndex(cameraIndex);

    try {
      const selectedCamera = cameras[cameraIndex];
      const camera = new CameraManager({ deviceId: selectedCamera.deviceId });
      cameraRef.current = camera;

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

    } catch (err) {
      setErrorMessage(`Hiba: ${err}`);
      setStatus('error');
    }
  };

  const switchCamera = async () => {
    if (cameras.length <= 1) return;
    const nextIndex = (selectedCameraIndex + 1) % cameras.length;
    cleanup();
    await startSharing(nextIndex);
  };

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
              <p className="text-sm text-dark-400">Osztd meg a kamerat mas eszkozoddel</p>
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
          {status === 'idle' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Camera className="w-10 h-10 text-blue-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Kamera Megosztasa</h3>
              <p className="text-dark-400 text-sm mb-6 max-w-xs mx-auto">
                Ez az eszkoz kamerajat megoszthatod mas bejelentkezett eszkozodkel virtualis kamerakent.
              </p>
              <div className="flex items-center justify-center gap-8 mb-6">
                <div className="flex flex-col items-center gap-2">
                  <Smartphone className="w-8 h-8 text-green-400" />
                  <span className="text-xs text-dark-400">Ez az eszkoz</span>
                </div>
                <div className="flex items-center gap-1 text-dark-500">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <div className="w-8 h-0.5 bg-blue-400/50" />
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Monitor className="w-8 h-8 text-blue-400" />
                  <span className="text-xs text-dark-400">Masik eszkoz</span>
                </div>
              </div>
              <Button onClick={requestCameraAccess} className="w-full">
                <Camera className="w-4 h-4 mr-2" />
                Kamera Engedelyezese
              </Button>
            </div>
          )}

          {status === 'requesting' && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-400 animate-spin" />
              <p className="text-white">Kamera hozzaferes kerese...</p>
              <p className="text-dark-400 text-sm mt-2">Engedelyezd a bongeszodben</p>
            </div>
          )}

          {status === 'selecting' && (
            <div className="space-y-4">
              <p className="text-dark-400 text-sm">Valassz egy kamerat:</p>
              <div className="space-y-2">
                {cameras.map((camera, index) => (
                  <button
                    key={camera.deviceId}
                    onClick={() => startSharing(index)}
                    className="w-full text-left p-4 rounded-lg bg-dark-700 border border-dark-600 hover:border-blue-500/50 hover:bg-dark-600 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <Camera className="w-5 h-5 text-blue-400" />
                      <div>
                        <div className="font-medium text-white">{camera.label}</div>
                        <div className="text-xs text-dark-400">{camera.deviceId.slice(0, 20)}...</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(status === 'sharing' || status === 'connected') && (
            <div className="space-y-4">
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 flex items-center gap-2 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm">
                  {status === 'connected' ? (
                    <>
                      <Wifi className="w-3 h-3 text-green-400" />
                      <span className="text-green-400 text-xs font-medium">Kapcsolodva</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-amber-400 text-xs font-medium">Varakozas...</span>
                    </>
                  )}
                </div>
                {cameras.length > 1 && (
                  <button
                    onClick={switchCamera}
                    className="absolute top-2 right-2 p-2 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white transition-colors"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="bg-dark-700/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  {status === 'connected' ? (
                    <Check className="w-5 h-5 text-green-400" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                  )}
                  <span className="text-white font-medium">
                    {status === 'connected' ? 'Kapcsolodva' : 'Varakozas masik eszkozre...'}
                  </span>
                </div>
                <p className="text-dark-400 text-sm">
                  {status === 'connected'
                    ? 'A kamera sikeresen megosztva. A masik eszkoz latja a videot.'
                    : 'Nyisd meg a dart alkalmazast egy masik eszkozodon es valaszd ki ezt a kamerat.'}
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
              <Button onClick={() => setStatus('idle')} variant="secondary" className="w-full">
                Ujraproba
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
