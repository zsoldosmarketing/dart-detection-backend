import { memo } from 'react';
import { Check, AlertCircle, Loader2 } from 'lucide-react';

interface CalibrationStatusBarProps {
  isCalibrated: boolean;
  isActive: boolean;
  boardConfidence: number;
  autoDetectEnabled: boolean;
  autoZoomEnabled: boolean;
  showSectorOverlay: boolean;
  error: string | null;
  statusMessage: string | null;
  pendingScore: boolean;
  remainingDarts: number;
  onToggleAutoDetect: () => void;
  onToggleAutoZoom: () => void;
  onToggleSectorOverlay: () => void;
}

export const CalibrationStatusBar = memo(function CalibrationStatusBar({
  isCalibrated,
  isActive,
  boardConfidence,
  autoDetectEnabled,
  autoZoomEnabled,
  showSectorOverlay,
  error,
  statusMessage,
  pendingScore,
  remainingDarts,
  onToggleAutoDetect,
  onToggleAutoZoom,
  onToggleSectorOverlay,
}: CalibrationStatusBarProps) {
  return (
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
              <div className="flex items-center gap-2">
                <button
                  onClick={onToggleAutoDetect}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    autoDetectEnabled
                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      : 'bg-dark-600 text-dark-400 hover:bg-dark-500'
                  }`}
                >
                  {autoDetectEnabled ? 'Auto ON' : 'Auto OFF'}
                </button>
                <button
                  onClick={onToggleAutoZoom}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    autoZoomEnabled
                      ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                      : 'bg-dark-600 text-dark-400 hover:bg-dark-500'
                  }`}
                >
                  {autoZoomEnabled ? 'Zoom ON' : 'Zoom OFF'}
                </button>
                <button
                  onClick={onToggleSectorOverlay}
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
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            </div>
            <p className="text-blue-300 font-medium">{statusMessage}</p>
          </div>
        )}
      </div>

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
  );
});
