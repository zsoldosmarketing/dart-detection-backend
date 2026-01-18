import { Download, X } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';

interface PWAInstallPromptProps {
  onInstall: () => void;
  onDismiss: () => void;
}

export function PWAInstallPrompt({ onInstall, onDismiss }: PWAInstallPromptProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
      <Card className="w-full max-w-md animate-slideUp">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                <Download className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-dark-900 dark:text-white">
                  Telepítsd az alkalmazást!
                </h3>
                <p className="text-sm text-dark-600 dark:text-dark-400">
                  Gyorsabb hozzáférés, offline használat
                </p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="p-1 rounded-lg text-dark-500 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-success-100 dark:bg-success-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-success-600 dark:text-success-400 text-sm font-bold">✓</span>
              </div>
              <div>
                <p className="text-sm font-medium text-dark-900 dark:text-white">
                  Azonnali hozzáférés
                </p>
                <p className="text-xs text-dark-600 dark:text-dark-400">
                  Indítsd el közvetlenül a kezdőképernyőről
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-success-100 dark:bg-success-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-success-600 dark:text-success-400 text-sm font-bold">✓</span>
              </div>
              <div>
                <p className="text-sm font-medium text-dark-900 dark:text-white">
                  Offline működés
                </p>
                <p className="text-xs text-dark-600 dark:text-dark-400">
                  Használd internetkapcsolat nélkül is
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-success-100 dark:bg-success-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-success-600 dark:text-success-400 text-sm font-bold">✓</span>
              </div>
              <div>
                <p className="text-sm font-medium text-dark-900 dark:text-white">
                  Nincs telepítési csomag
                </p>
                <p className="text-xs text-dark-600 dark:text-dark-400">
                  Kevesebb mint 1 MB, azonnal használható
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={onInstall}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Telepítés
            </Button>
            <Button
              onClick={onDismiss}
              variant="ghost"
            >
              Később
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
