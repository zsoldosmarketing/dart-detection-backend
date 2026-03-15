import { memo } from 'react';
import {
  Camera,
  X,
  Smartphone,
  Wifi,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import type { CameraDevice } from '../../lib/cameraManager';
import type { RemoteCameraSession } from '../../lib/remoteCameraSharing';

interface CameraSettingsModalProps {
  availableCameras: CameraDevice[];
  remoteCameras: RemoteCameraSession[];
  currentCameraIndex: number;
  activeRemoteCamera: string | null;
  connectingRemoteId: string | null;
  onClose: () => void;
  onSelectCamera: (index: number) => void;
  onConnectRemoteCamera: (session: RemoteCameraSession) => void;
}

export const CameraSettingsModal = memo(function CameraSettingsModal({
  availableCameras,
  remoteCameras,
  currentCameraIndex,
  activeRemoteCamera,
  connectingRemoteId,
  onClose,
  onSelectCamera,
  onConnectRemoteCamera,
}: CameraSettingsModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-dark-800 rounded-xl border border-dark-700 shadow-2xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Camera className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Kamera választás</h3>
              <p className="text-sm text-dark-400">Válassz az elérhető kamerák közül</p>
            </div>
          </div>
          <button
            onClick={onClose}
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
                  onClick={() => onConnectRemoteCamera(session)}
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
                        <span className="text-sm font-medium">Aktív</span>
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
                  onClick={() => onSelectCamera(index)}
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
                        <span className="text-sm font-medium">Aktív</span>
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
  );
});
