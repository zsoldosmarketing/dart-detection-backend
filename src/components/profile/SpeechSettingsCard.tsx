import { useState, useEffect, memo } from 'react';
import {
  Mic,
  Volume2,
  Wifi,
  WifiOff,
  Download,
  Trash2,
} from 'lucide-react';
import { Card, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { speechEngine, type SpeechEngineType } from '../../lib/offlineSpeech';

export const SpeechSettingsCard = memo(function SpeechSettingsCard() {
  const [speechEngineType, setSpeechEngineType] = useState<SpeechEngineType>('web');
  const [offlineModelsReady, setOfflineModelsReady] = useState(false);
  const [isDownloadingModels, setIsDownloadingModels] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDeletingModels, setIsDeletingModels] = useState(false);

  useEffect(() => {
    checkOfflineModels();
  }, []);

  const checkOfflineModels = async () => {
    setSpeechEngineType(speechEngine.getEngineType());
    const ready = await speechEngine.checkOfflineReady();
    setOfflineModelsReady(ready);
  };

  const handleDownloadOfflineModels = async () => {
    setIsDownloadingModels(true);
    setDownloadProgress(0);
    try {
      await speechEngine.downloadOfflineModels((progress) => {
        setDownloadProgress(progress);
      });
      setOfflineModelsReady(true);
    } catch (error) {
      console.error('Download error:', error);
      alert('Hiba a modell letoltese soran');
    } finally {
      setIsDownloadingModels(false);
    }
  };

  const handleDeleteOfflineModels = async () => {
    if (!confirm('Biztosan torolod az offline beszed modellt? (kb. 63MB tarol fog felszabadulni)')) return;
    setIsDeletingModels(true);
    try {
      await speechEngine.deleteOfflineModels();
      setOfflineModelsReady(false);
      setSpeechEngineType('web');
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setIsDeletingModels(false);
    }
  };

  const handleSpeechEngineChange = async (type: SpeechEngineType) => {
    if (type === 'offline' && !offlineModelsReady) {
      alert('Eloszor toltsd le az offline modelleket!');
      return;
    }
    try {
      await speechEngine.setEngineType(type);
      setSpeechEngineType(type);
    } catch (error) {
      console.error('Engine change error:', error);
    }
  };

  return (
    <Card>
      <CardTitle>
        <div className="flex items-center gap-2">
          <Mic className="w-5 h-5" />
          <Volume2 className="w-5 h-5" />
          Hangfelismerés Motor
        </div>
      </CardTitle>
      <p className="text-sm text-dark-500 dark:text-dark-400 mt-2">
        Válaszd ki milyen motorral működjön a hangfelismerés és beszéd
      </p>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => handleSpeechEngineChange('web')}
          className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
            speechEngineType === 'web'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-dark-200 dark:border-dark-700 hover:border-dark-300 dark:hover:border-dark-600'
          }`}
        >
          <Wifi className={`w-6 h-6 ${speechEngineType === 'web' ? 'text-primary-600 dark:text-primary-400' : 'text-dark-500'}`} />
          <span className={`text-sm font-medium ${speechEngineType === 'web' ? 'text-primary-600 dark:text-primary-400' : 'text-dark-600 dark:text-dark-400'}`}>
            Web Speech
          </span>
          <span className="text-xs text-dark-400">Alapértelmezett</span>
        </button>

        <button
          onClick={() => handleSpeechEngineChange('offline')}
          disabled={!offlineModelsReady}
          className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
            speechEngineType === 'offline'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : offlineModelsReady
                ? 'border-dark-200 dark:border-dark-700 hover:border-dark-300 dark:hover:border-dark-600'
                : 'border-dark-200 dark:border-dark-700 opacity-50 cursor-not-allowed'
          }`}
        >
          <WifiOff className={`w-6 h-6 ${speechEngineType === 'offline' ? 'text-primary-600 dark:text-primary-400' : 'text-dark-500'}`} />
          <span className={`text-sm font-medium ${speechEngineType === 'offline' ? 'text-primary-600 dark:text-primary-400' : 'text-dark-600 dark:text-dark-400'}`}>
            Offline
          </span>
          <span className="text-xs text-dark-400">Piper TTS</span>
        </button>
      </div>

      <div className="mt-4 p-3 bg-dark-50 dark:bg-dark-800 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-dark-700 dark:text-dark-300">
            Offline modellek
          </span>
          {offlineModelsReady ? (
            <Badge variant="success" size="sm">Letöltve</Badge>
          ) : (
            <Badge variant="secondary" size="sm">Nincs letöltve</Badge>
          )}
        </div>

        {isDownloadingModels && (
          <div className="space-y-2 mb-3">
            <div>
              <div className="flex justify-between text-xs text-dark-500 mb-1">
                <span>Piper (beszedszintezis)</span>
                <span>{downloadProgress}%</span>
              </div>
              <div className="h-2 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {!offlineModelsReady && !isDownloadingModels && (
          <div className="text-xs text-dark-500 dark:text-dark-400 mb-3">
            <p>Letoltes merete: ~63 MB</p>
            <p className="mt-1">Offline beszedszintezis magyar Piper hanggal. A hangfelismeres tovabbra is Web Speech API-t hasznalja.</p>
          </div>
        )}

        <div className="flex gap-2">
          {!offlineModelsReady ? (
            <Button
              onClick={handleDownloadOfflineModels}
              isLoading={isDownloadingModels}
              leftIcon={<Download className="w-4 h-4" />}
              className="flex-1"
            >
              {isDownloadingModels ? 'Letöltés...' : 'Modellek letöltése'}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handleDeleteOfflineModels}
              isLoading={isDeletingModels}
              leftIcon={<Trash2 className="w-4 h-4" />}
              className="flex-1"
            >
              Modellek törlése
            </Button>
          )}
        </div>
      </div>

      {speechEngineType === 'web' && (
        <p className="mt-3 text-xs text-dark-400 dark:text-dark-500">
          A Web Speech API a böngésző beépített hangfelismerését használja. Internet kapcsolat szükséges.
        </p>
      )}
      {speechEngineType === 'offline' && (
        <p className="mt-3 text-xs text-dark-400 dark:text-dark-500">
          Az offline mod helyi Piper modellt hasznal a beszedszintezishez. A hangfelismeres Web Speech API-val mukodik.
        </p>
      )}
    </Card>
  );
});
