import { AlertCircle, X, Trash2 } from 'lucide-react';
import { Card, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface StaleGame {
  id: string;
  hoursOld: number;
  status: string;
}

interface StaleGameModalProps {
  game: StaleGame | null;
  onSurrender: (gameId: string) => void;
  onDismiss: (gameId: string) => void;
  onClose: () => void;
  isProcessing: boolean;
}

export function StaleGameModal({
  game,
  onSurrender,
  onDismiss,
  onClose,
  isProcessing,
}: StaleGameModalProps) {
  if (!game) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <Card className="max-w-md w-full animate-scale-in">
        <div className="relative">
          <button
            onClick={onClose}
            className="absolute top-0 right-0 p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
            disabled={isProcessing}
          >
            <X className="w-5 h-5 text-dark-500" />
          </button>

          <div className="pt-6 pb-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-warning-400 to-warning-600 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-white" />
            </div>

            <CardTitle className="text-center mb-4">
              Régi Aktív Játék Észlelve
            </CardTitle>

            <div className="bg-warning-50 dark:bg-warning-900/20 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <AlertCircle className="w-5 h-5 text-warning-600 dark:text-warning-400 flex-shrink-0" />
                <p className="text-sm text-warning-800 dark:text-warning-300">
                  Van egy <strong>{Math.floor(game.hoursOld)} órás</strong> aktív játékod
                </p>
              </div>
              <Badge variant="warning" size="sm" className="mb-2">
                {game.status === 'in_progress' ? 'Folyamatban' : 'Szüneteltetve'}
              </Badge>
              <p className="text-xs text-warning-700 dark:text-warning-400 mt-2">
                Ez valószínűleg már nem aktuális és automatikusan feladható
              </p>
            </div>

            <div className="space-y-3 px-4">
              <Button
                onClick={() => onSurrender(game.id)}
                disabled={isProcessing}
                variant="primary"
                className="w-full bg-error-600 hover:bg-error-700"
                leftIcon={<Trash2 className="w-4 h-4" />}
              >
                {isProcessing ? 'Feldolgozás...' : 'Feladom a Játékot'}
              </Button>

              <Button
                onClick={() => onDismiss(game.id)}
                disabled={isProcessing}
                variant="outline"
                className="w-full"
                leftIcon={<X className="w-4 h-4" />}
              >
                Folytatom Később
              </Button>

              <p className="text-xs text-dark-500 dark:text-dark-400 text-center mt-2">
                Ha folytatod később, ezt az üzenetet nem látod többet erre a játékra
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
