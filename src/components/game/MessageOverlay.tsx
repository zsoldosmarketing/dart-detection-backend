import { memo } from 'react';
import { Mic, Target, Settings } from 'lucide-react';
import { Button } from '../ui/Button';
import { t } from '../../lib/i18n';

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
                <h2 className="text-2xl font-bold text-dark-900 dark:text-white">{t('voice.help_title')}</h2>
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
                  {t('voice.how_it_works')}
                </h3>
                <p className="text-sm text-dark-700 dark:text-dark-300 mb-3">
                  {t('voice.description')}
                </p>
                <p className="text-sm text-dark-700 dark:text-dark-300">
                  {t('voice.auto_on')}
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-3">{t('voice.commands_title')}</h3>
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20">
                    <p className="font-semibold text-primary-700 dark:text-primary-300 mb-1">{t('voice.single')}</p>
                    <p className="text-sm text-dark-700 dark:text-dark-300">
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">húsz</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">20</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded">egy</span>
                    </p>
                    <p className="text-xs text-dark-600 dark:text-dark-400 mt-1">{t('voice.single_example')}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20">
                    <p className="font-semibold text-primary-700 dark:text-primary-300 mb-1">{t('voice.double')}</p>
                    <p className="text-sm text-dark-700 dark:text-dark-300">
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">dupla húsz</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded">D20</span>
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20">
                    <p className="font-semibold text-primary-700 dark:text-primary-300 mb-1">{t('voice.triple')}</p>
                    <p className="text-sm text-dark-700 dark:text-dark-300">
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">tripla húsz</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded">T20</span>
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20">
                    <p className="font-semibold text-primary-700 dark:text-primary-300 mb-1">{t('voice.bull50')}</p>
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
                    <p className="font-semibold text-primary-700 dark:text-primary-300 mb-1">{t('voice.bull25')}</p>
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
                    <p className="font-semibold text-primary-700 dark:text-primary-300 mb-1">{t('voice.miss')}</p>
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
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-3">{t('voice.control_title')}</h3>
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-secondary-50 dark:bg-secondary-900/20">
                    <p className="font-semibold text-secondary-700 dark:text-secondary-300 mb-1">{t('voice.undo_cmd')}</p>
                    <p className="text-sm text-dark-700 dark:text-dark-300 mb-2">
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">vissza</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">törlés</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">töröl</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">undo</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded mr-1">delete</span>
                      <span className="font-mono bg-white dark:bg-dark-700 px-2 py-1 rounded">előző</span>
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-secondary-50 dark:bg-secondary-900/20">
                    <p className="font-semibold text-secondary-700 dark:text-secondary-300 mb-1">{t('voice.submit_cmd')}</p>
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
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-3 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary-500" />
                  {t('voice.tips_title')}
                </h3>
                <div className="space-y-3 text-sm text-dark-700 dark:text-dark-300">
                  <div className="flex items-start gap-2">
                    <span className="text-primary-500 mt-0.5">•</span>
                    <p>{t('voice.tip_mode')}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-primary-500 mt-0.5">•</span>
                    <p>{t('voice.tip_noise')}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-primary-500 mt-0.5">•</span>
                    <p>{t('voice.tip_mic')}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-dark-200 dark:border-dark-700">
                <Button
                  onClick={onCloseVoiceHelp}
                  className="w-full"
                >
                  {t('voice.understood')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
