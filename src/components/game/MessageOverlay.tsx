import { memo } from 'react';
import { Mic, Target, Settings } from 'lucide-react';
import { Button } from '../ui/Button';

interface MessageOverlayProps {
  message: string | null;
  showVoiceHelp: boolean;
  voiceRecognitionEnabled: boolean;
  onCloseVoiceHelp: () => void;
}

export const MessageOverlay = memo(function MessageOverlay({
  message,
  showVoiceHelp,
  voiceRecognitionEnabled,
  onCloseVoiceHelp,
}: MessageOverlayProps) {
  return (
    <>
      {message && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-dark-800 rounded-2xl p-8 text-center animate-scale-in">
            <div className="text-4xl font-bold text-primary-600 dark:text-primary-400">
              {message}
            </div>
          </div>
        </div>
      )}

      {showVoiceHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCloseVoiceHelp}>
          <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                  <Mic className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                <h2 className="text-2xl font-bold text-dark-900 dark:text-white">Hangvezérlés súgó</h2>
              </div>
              <button
                onClick={onCloseVoiceHelp}
                className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
              >
                <span className="text-2xl text-dark-500">×</span>
              </button>
            </div>

            <div className="space-y-6 text-left">
              <div>
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-3 flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary-500" />
                  Hogyan működik a hangvezérlés?
                </h3>
                <p className="text-sm text-dark-700 dark:text-dark-300 mb-3">
                  A hangvezérlés lehetővé teszi, hogy hangparancsokkal rögzítsd a dobásaidat. Nincs szükség gomb megnyomására - csak mondd ki a dobásod!
                </p>
                <p className="text-sm text-dark-700 dark:text-dark-300">
                  A mikrofon ikon {voiceRecognitionEnabled ? 'zöld színnel jelzi, hogy a hangvezérlés aktív' : 'szürkével jelzi, hogy a hangvezérlés kikapcsolt állapotban van'}.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-3">Dobás parancsok</h3>
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20">
                    <p className="font-semibold text-primary-700 dark:text-primary-300 mb-1">Egyszeres dobás</p>
                    <p className="text-sm text-dark-700 dark:text-dark-300">
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">húsz</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">20</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded">egy</span>
                    </p>
                    <p className="text-xs text-dark-600 dark:text-dark-400 mt-1">Bármely szám 1-től 20-ig, szóban vagy számmal</p>
                  </div>

                  <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20">
                    <p className="font-semibold text-primary-700 dark:text-primary-300 mb-1">Dupla dobás</p>
                    <p className="text-sm text-dark-700 dark:text-dark-300">
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">dupla húsz</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded">D20</span>
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20">
                    <p className="font-semibold text-primary-700 dark:text-primary-300 mb-1">Tripla dobás</p>
                    <p className="text-sm text-dark-700 dark:text-dark-300">
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">tripla húsz</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded">T20</span>
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20">
                    <p className="font-semibold text-primary-700 dark:text-primary-300 mb-1">Dupla bull (50 pont)</p>
                    <p className="text-sm text-dark-700 dark:text-dark-300">
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">bull</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">ötven</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">50</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">közép</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">bika</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">nagybull</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded">dupla bull</span>
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20">
                    <p className="font-semibold text-primary-700 dark:text-primary-300 mb-1">Kis bull (25 pont)</p>
                    <p className="text-sm text-dark-700 dark:text-dark-300">
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">kisbull</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">kis bull</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">huszonöt</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">25</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">külső bull</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded">szimpla bull</span>
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20">
                    <p className="font-semibold text-primary-700 dark:text-primary-300 mb-1">Mellé dobás (0 pont)</p>
                    <p className="text-sm text-dark-700 dark:text-dark-300">
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">miss</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">mellé</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">nulla</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded">0</span>
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-3">Vezérlő parancsok</h3>
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-secondary-50 dark:bg-secondary-900/20">
                    <p className="font-semibold text-secondary-700 dark:text-secondary-300 mb-1">Visszavonás / Törlés</p>
                    <p className="text-sm text-dark-700 dark:text-dark-300 mb-2">
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">vissza</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">törlés</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">töröl</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">undo</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">delete</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded">előző</span>
                    </p>
                    <p className="text-xs text-dark-600 dark:text-dark-400">Utolsó dobás törlése</p>
                  </div>

                  <div className="p-3 rounded-lg bg-secondary-50 dark:bg-secondary-900/20">
                    <p className="font-semibold text-secondary-700 dark:text-secondary-300 mb-1">Beküldés / Kör lezárása</p>
                    <p className="text-sm text-dark-700 dark:text-dark-300 mb-2">
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">beküld</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">küld</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">kész</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">oké</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">ok</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">mehet</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">megy</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">rendben</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">rajta</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">gyerünk</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">indulhat</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded">következő</span>
                    </p>
                    <p className="text-xs text-dark-600 dark:text-dark-400">Kör beküldése (3 dobás után automatikus)</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-3 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary-500" />
                  Beállítási tippek
                </h3>
                <div className="space-y-3 text-sm text-dark-700 dark:text-dark-300">
                  <div className="flex items-start gap-2">
                    <span className="text-primary-500 mt-0.5">•</span>
                    <p><strong>Felismerési mód:</strong> Zajos környezetben válaszd a "Pontos" módot a jobb eredményekért.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-primary-500 mt-0.5">•</span>
                    <p><strong>Zajszűrés:</strong> Ha a rendszer túl érzékeny, állítsd a küszöböt alacsonyabb értékre (-60 dB körül).</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-primary-500 mt-0.5">•</span>
                    <p><strong>Mikrofonhasználat:</strong> Beszélj tisztán és közvetlenül a mikrofon felé. A parancsok közötti kis szünet segít a felismerésben.</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-dark-200 dark:border-dark-700">
                <Button
                  onClick={onCloseVoiceHelp}
                  className="w-full"
                >
                  Értettem
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
