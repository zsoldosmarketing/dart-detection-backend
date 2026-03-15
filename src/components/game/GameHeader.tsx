import { memo } from 'react';
import { t } from '../../lib/i18n';
import {
  ChevronLeft,
  Volume2,
  VolumeX,
  Flag,
  Save,
  Server,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface GameHeaderProps {
  mode: 'bot' | 'pvp' | 'local';
  currentLeg: number;
  startingScore: number;
  soundEnabled: boolean;
  isProcessing: boolean;
  isAdmin: boolean;
  isLocalBackend: boolean;
  onNavigateBack: () => void;
  onSurrender: () => void;
  onSaveAndExit: () => void;
  onToggleSound: () => void;
  onToggleBackend: () => void;
}

export const GameHeader = memo(function GameHeader({
  mode,
  currentLeg,
  startingScore,
  soundEnabled,
  isProcessing,
  isAdmin,
  isLocalBackend,
  onNavigateBack,
  onSurrender,
  onSaveAndExit,
  onToggleSound,
  onToggleBackend,
}: GameHeaderProps) {
  return (
    <div className="shrink-0 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          leftIcon={<ChevronLeft className="w-4 h-4" />}
          onClick={onNavigateBack}
        >
          {t('game.back')}
        </Button>
        {isAdmin && (
          <button
            onClick={onToggleBackend}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              isLocalBackend
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
            }`}
            title={isLocalBackend ? 'Local Backend' : 'Online Backend'}
          >
            <Server className="w-3.5 h-3.5" />
            {isLocalBackend ? 'LOCAL' : 'ONLINE'}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {mode === 'pvp' && (
          <>
            <button
              onClick={onSurrender}
              disabled={isProcessing}
              className="p-2 rounded-lg transition-colors bg-error-100 dark:bg-error-900/30 text-error-600 dark:text-error-400 hover:bg-error-200 dark:hover:bg-error-900/50 disabled:opacity-50"
              title="Feladás"
            >
              <Flag className="w-5 h-5" />
            </button>
            <button
              onClick={onSaveAndExit}
              disabled={isProcessing}
              className="p-2 rounded-lg transition-colors bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400 hover:bg-warning-200 dark:hover:bg-warning-900/50 disabled:opacity-50"
              title="Mentés és kilépés"
            >
              <Save className="w-5 h-5" />
            </button>
          </>
        )}
        <button
          onClick={onToggleSound}
          className={`p-2 rounded-lg transition-colors ${
            soundEnabled
              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
              : 'bg-dark-100 dark:bg-dark-700 text-dark-400'
          }`}
          title={soundEnabled ? t('common.sound_off') : t('common.sound_on')}
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
        <Badge variant="primary">{t('game.leg')} {currentLeg}</Badge>
        <Badge variant="secondary">{startingScore}</Badge>
      </div>
    </div>
  );
});
