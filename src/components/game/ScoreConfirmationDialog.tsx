import { memo } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '../ui/Button';
import type { ThrowScoreResult } from '../../lib/dartDetectionApi';

interface ScoreConfirmationDialogProps {
  pendingScore: ThrowScoreResult;
  isFullscreen: boolean;
  onConfirm: () => void;
  onReject: () => void;
}

export const ScoreConfirmationDialog = memo(function ScoreConfirmationDialog({
  pendingScore,
  isFullscreen,
  onConfirm,
  onReject,
}: ScoreConfirmationDialogProps) {
  if (isFullscreen) {
    return (
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
            onClick={onConfirm}
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-500"
            leftIcon={<Check className="w-4 h-4" />}
          >
            OK
          </Button>
          <Button
            variant="outline"
            onClick={onReject}
            size="sm"
            className="flex-1"
            leftIcon={<X className="w-4 h-4" />}
          >
            Nem
          </Button>
        </div>
      </div>
    );
  }

  return (
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
          onClick={onConfirm}
          className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 shadow-lg shadow-green-500/20"
          leftIcon={<Check className="w-4 h-4" />}
        >
          Elfogadom
        </Button>
        <Button
          variant="outline"
          onClick={onReject}
          className="flex-1 border-dark-600 hover:bg-dark-700"
          leftIcon={<X className="w-4 h-4" />}
        >
          Elutasitom
        </Button>
      </div>
    </div>
  );
});
