import { memo, useState } from 'react';
import { Check, Edit3, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { t } from '../../lib/i18n';
import type { DartTarget } from '../../lib/dartsEngine';
import type { ThrowScoreResult } from '../../lib/dartDetectionApi';

interface ScoreConfirmationDialogProps {
  pendingScore: ThrowScoreResult;
  isFullscreen: boolean;
  onConfirm: () => void;
  onCorrect: (target: DartTarget) => void;
  onReject: () => void;
}

type Multiplier = 'S' | 'D' | 'T';

const MULTIPLIER_LABELS: Record<Multiplier, string> = {
  S: 'Single',
  D: 'Dupla',
  T: 'Tripla',
};

export const ScoreConfirmationDialog = memo(function ScoreConfirmationDialog({
  pendingScore,
  isFullscreen,
  onConfirm,
  onCorrect,
  onReject,
}: ScoreConfirmationDialogProps) {
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [multiplier, setMultiplier] = useState<Multiplier>('S');
  const containerClass = isFullscreen
    ? 'absolute bottom-6 left-1/2 z-20 w-[min(95vw,30rem)] -translate-x-1/2 bg-dark-800 border border-dark-600 rounded-xl p-4 shadow-2xl'
    : 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-5';

  const applyCorrection = (target: DartTarget) => {
    onCorrect(target);
    setIsCorrecting(false);
  };

  return (
    <div className={containerClass}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-2xl font-bold text-amber-300">{pendingScore.label}</p>
          <p className="text-base text-amber-200">{t('score.confirm_points', { score: pendingScore.score })}</p>
          <div className="flex items-center gap-2 mt-2">
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
        {isCorrecting && (
          <button
            type="button"
            onClick={() => setIsCorrecting(false)}
            className="text-xs font-medium text-dark-300 hover:text-white"
          >
            Vissza
          </button>
        )}
      </div>

      {isCorrecting ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-dark-200">Jelöld meg a tényleges találatot:</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(MULTIPLIER_LABELS) as Multiplier[]).map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setMultiplier(value)}
                className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                  multiplier === value
                    ? 'bg-amber-500 text-white'
                    : 'bg-dark-700 text-dark-200 hover:bg-dark-600'
                }`}
              >
                {MULTIPLIER_LABELS[value]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: 20 }, (_, index) => index + 1).map(number => (
              <button
                key={number}
                type="button"
                onClick={() => applyCorrection(`${multiplier}${number}` as DartTarget)}
                className="rounded-lg bg-dark-700 px-2 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-500"
              >
                {number}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => applyCorrection('OB')}
              className="rounded-lg bg-dark-700 px-2.5 py-2 text-xs font-semibold text-white hover:bg-amber-500"
            >
              Külső bull
            </button>
            <button
              type="button"
              onClick={() => applyCorrection('BULL')}
              className="rounded-lg bg-dark-700 px-2.5 py-2 text-xs font-semibold text-white hover:bg-amber-500"
            >
              Bull
            </button>
            <button
              type="button"
              onClick={() => applyCorrection('MISS')}
              className="rounded-lg bg-dark-700 px-2.5 py-2 text-xs font-semibold text-white hover:bg-red-500"
            >
              Mellé
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={onConfirm}
            size="sm"
            className="bg-green-600 hover:bg-green-500"
            leftIcon={<Check className="w-4 h-4" />}
          >
            {t('score.accept')}
          </Button>
          <Button
            onClick={() => setIsCorrecting(true)}
            size="sm"
            className="bg-amber-600 hover:bg-amber-500"
            leftIcon={<Edit3 className="w-4 h-4" />}
          >
            Javítás
          </Button>
          <Button
            variant="outline"
            onClick={onReject}
            size="sm"
            className="border-dark-600 hover:bg-dark-700"
            leftIcon={<X className="w-4 h-4" />}
          >
            {isFullscreen ? t('score.no') : t('score.reject')}
          </Button>
        </div>
      )}
    </div>
  );
});
