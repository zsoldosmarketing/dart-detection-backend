import { voiceRecognition, type VoiceRecognitionResult } from '../voiceRecognition';
import { voiceCaller } from '../voiceCaller';
import { voskRecognition } from './voskRecognition';
import { piperTTS } from './piperTTS';
import { offlineModels } from './offlineModels';
import { getLocale } from '../i18n';

export type SpeechEngineType = 'web' | 'offline';

const ENGINE_STORAGE_KEY = 'speech-engine-type';

class SpeechEngineService {
  private engineType: SpeechEngineType = 'web';
  private listeners: Array<(type: SpeechEngineType) => void> = [];
  private offlineInitialized = false;
  private offlineInitPromise: Promise<void> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(ENGINE_STORAGE_KEY) as SpeechEngineType;
      if (stored === 'offline' && offlineModels.areAllReady()) {
        this.engineType = 'offline';
      }
    }
  }

  getEngineType(): SpeechEngineType {
    return this.engineType;
  }

  async setEngineType(type: SpeechEngineType): Promise<void> {
    if (type === 'offline') {
      const ready = await this.checkOfflineReady();
      if (!ready) {
        throw new Error('Offline models not ready');
      }
    }

    this.engineType = type;
    if (typeof window !== 'undefined') {
      localStorage.setItem(ENGINE_STORAGE_KEY, type);
    }
    this.notifyListeners();
  }

  onEngineChange(callback: (type: SpeechEngineType) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb(this.engineType));
  }

  async checkOfflineReady(): Promise<boolean> {
    await offlineModels.init();
    return offlineModels.areAllReady();
  }

  async initOffline(): Promise<void> {
    if (this.offlineInitialized) return;
    if (this.offlineInitPromise) return this.offlineInitPromise;

    this.offlineInitPromise = this.doInitOffline();
    return this.offlineInitPromise;
  }

  private async doInitOffline(): Promise<void> {
    try {
      await voskRecognition.init();
      await piperTTS.init();
      this.offlineInitialized = true;
    } catch (error) {
      this.offlineInitPromise = null;
      throw error;
    }
  }

  isRecognitionAvailable(): boolean {
    if (this.engineType === 'offline') {
      return voskRecognition.isAvailable();
    }
    return voiceRecognition.isAvailable();
  }

  startListening(
    onResult: (result: VoiceRecognitionResult) => void,
    onError?: (error: string) => void
  ): void {
    if (this.engineType === 'offline') {
      this.startOfflineListening(onResult, onError);
    } else {
      voiceRecognition.startListening(onResult, onError);
    }
  }

  private async startOfflineListening(
    onResult: (result: VoiceRecognitionResult) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    try {
      if (!voskRecognition.isReady()) {
        await voskRecognition.init();
      }

      const locale = getLocale();
      await voskRecognition.startListening(
        (text, isFinal) => {
          if (isFinal && text) {
            const parsed = voiceRecognition.parseTranscript(text, locale);
            if (parsed) {
              onResult(parsed);
            } else if (onError) {
              onError('Not recognized');
            }
          }
        },
        onError
      );
    } catch (error) {
      if (onError) {
        onError(error instanceof Error ? error.message : 'Failed to start');
      }
    }
  }

  startContinuousListening(
    onTranscript: (transcript: string, isFinal: boolean) => void,
    onError?: (error: string) => void
  ): void {
    if (this.engineType === 'offline') {
      this.startOfflineContinuousListening(onTranscript, onError);
    } else {
      voiceRecognition.startContinuousListening(onTranscript, onError);
    }
  }

  private async startOfflineContinuousListening(
    onTranscript: (transcript: string, isFinal: boolean) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    try {
      if (!voskRecognition.isReady()) {
        await voskRecognition.init();
      }

      await voskRecognition.startListening(onTranscript, onError);
    } catch (error) {
      if (onError) {
        onError(error instanceof Error ? error.message : 'Failed to start');
      }
    }
  }

  stopListening(): void {
    if (this.engineType === 'offline') {
      voskRecognition.stopListening();
    } else {
      voiceRecognition.stopListening();
    }
  }

  pauseListening(): void {
    if (this.engineType === 'web') {
      voiceRecognition.pauseListening();
    }
  }

  resumeListening(): void {
    if (this.engineType === 'web') {
      voiceRecognition.resumeListening();
    }
  }

  isCurrentlyListening(): boolean {
    if (this.engineType === 'offline') {
      return voskRecognition.isCurrentlyListening();
    }
    return voiceRecognition.isCurrentlyListening();
  }

  parseTranscript(transcript: string, locale: string): VoiceRecognitionResult | null {
    return voiceRecognition.parseTranscript(transcript, locale);
  }

  parseMultipleTranscripts(transcript: string, locale: string): VoiceRecognitionResult[] {
    return voiceRecognition.parseMultipleTranscripts(transcript, locale);
  }

  async speak(text: string, priority: 'high' | 'normal' = 'normal', rate?: number): Promise<void> {
    if (this.engineType === 'offline') {
      await this.offlineSpeak(text);
    } else {
      await voiceCaller.speak(text, priority, rate);
    }
  }

  private async offlineSpeak(text: string): Promise<void> {
    try {
      if (!piperTTS.isReady()) {
        await piperTTS.init();
      }
      await piperTTS.speak(text);
    } catch (error) {
      console.error('[SpeechEngine] Offline speak error:', error);
    }
  }

  stopSpeaking(): void {
    if (this.engineType === 'offline') {
      piperTTS.stop();
    } else {
      voiceCaller.stop();
    }
  }

  isSpeaking(): boolean {
    if (this.engineType === 'offline') {
      return piperTTS.isSpeakingNow();
    }
    return voiceCaller.isSpeaking();
  }

  onSpeakingChange(callback: (isSpeaking: boolean) => void): () => void {
    if (this.engineType === 'offline') {
      return piperTTS.onSpeakingChange(callback);
    }
    return voiceCaller.onSpeakingChange(callback);
  }

  getVoiceCallerForWebSpeech() {
    return voiceCaller;
  }

  getVoiceRecognitionForWebSpeech() {
    return voiceRecognition;
  }

  async downloadOfflineModels(
    onProgress?: (voskProgress: number, piperProgress: number) => void
  ): Promise<void> {
    await offlineModels.init();

    let voskProgress = offlineModels.isReady('vosk-hu') ? 100 : 0;
    let piperProgress = offlineModels.isReady('piper-hu') ? 100 : 0;

    const unsubVosk = offlineModels.onProgress('vosk-hu', (info) => {
      voskProgress = info.progress;
      if (onProgress) onProgress(voskProgress, piperProgress);
    });

    const unsubPiper = offlineModels.onProgress('piper-hu', (info) => {
      piperProgress = info.progress;
      if (onProgress) onProgress(voskProgress, piperProgress);
    });

    try {
      if (!offlineModels.isReady('vosk-hu')) {
        await offlineModels.downloadModel('vosk-hu');
      }
      if (!offlineModels.isReady('piper-hu')) {
        await offlineModels.downloadModel('piper-hu');
      }
    } finally {
      unsubVosk();
      unsubPiper();
    }
  }

  async deleteOfflineModels(): Promise<void> {
    if (this.engineType === 'offline') {
      await this.setEngineType('web');
    }
    await offlineModels.deleteAllModels();
    this.offlineInitialized = false;
    this.offlineInitPromise = null;
  }

  getOfflineModelsSize(): string {
    return offlineModels.formatSize(offlineModels.getTotalDownloadSize());
  }

  isOfflineModelsReady(): boolean {
    return offlineModels.areAllReady();
  }
}

export const speechEngine = new SpeechEngineService();
