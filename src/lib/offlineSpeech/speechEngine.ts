import { voiceRecognition, type VoiceRecognitionResult } from '../voiceRecognition';
import { voiceCaller } from '../voiceCaller';
import { piperTTS } from './piperTTS';
import { offlineModels } from './offlineModels';

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
      await piperTTS.init();
      this.offlineInitialized = true;
    } catch (error) {
      this.offlineInitPromise = null;
      throw error;
    }
  }

  isRecognitionAvailable(): boolean {
    return voiceRecognition.isAvailable();
  }

  startListening(
    onResult: (result: VoiceRecognitionResult) => void,
    onError?: (error: string) => void
  ): void {
    voiceRecognition.startListening(onResult, onError);
  }

  startContinuousListening(
    onTranscript: (transcript: string, isFinal: boolean) => void,
    onError?: (error: string) => void
  ): void {
    voiceRecognition.startContinuousListening(onTranscript, onError);
  }

  stopListening(): void {
    voiceRecognition.stopListening();
  }

  pauseListening(): void {
    voiceRecognition.pauseListening();
  }

  resumeListening(): void {
    voiceRecognition.resumeListening();
  }

  isCurrentlyListening(): boolean {
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
      await voiceCaller.speak(text, 'normal');
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
    onProgress?: (piperProgress: number) => void
  ): Promise<void> {
    await offlineModels.init();

    const unsubPiper = offlineModels.onProgress('piper-hu', (info) => {
      if (onProgress) onProgress(info.progress);
    });

    try {
      if (!offlineModels.isReady('piper-hu')) {
        await offlineModels.downloadModel('piper-hu');
      }
      if (onProgress) onProgress(100);
    } finally {
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
