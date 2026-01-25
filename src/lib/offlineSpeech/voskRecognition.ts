import { offlineModels } from './offlineModels';

declare global {
  interface Window {
    Vosk: any;
  }
}

const VOSK_WASM_URL = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js';
const VOSK_MODEL_URL = 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip';

export interface VoskResult {
  text: string;
  result?: Array<{
    word: string;
    start: number;
    end: number;
    conf: number;
  }>;
  partial?: string;
}

class VoskRecognitionService {
  private model: any = null;
  private recognizer: any = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private isListening = false;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    try {
      if (!window.Vosk) {
        await this.loadVoskLibrary();
      }

      console.log('[VoskRecognition] Loading model from URL...');

      const cachedModel = await offlineModels.getModel('vosk-en');
      if (cachedModel) {
        console.log('[VoskRecognition] Using cached model');
        this.model = await window.Vosk.createModel(new Blob([cachedModel], { type: 'application/zip' }));
      } else {
        console.log('[VoskRecognition] Downloading model...');
        this.model = await window.Vosk.createModel(VOSK_MODEL_URL);
      }

      console.log('[VoskRecognition] Model loaded');
      this.isInitialized = true;
    } catch (error) {
      console.error('[VoskRecognition] Init error:', error);
      this.initPromise = null;
      throw error;
    }
  }

  private async loadVoskLibrary(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = VOSK_WASM_URL;
      script.onload = () => {
        console.log('[VoskRecognition] Vosk library loaded');
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Vosk library'));
      document.head.appendChild(script);
    });
  }

  isAvailable(): boolean {
    return true;
  }

  isReady(): boolean {
    return this.isInitialized && this.model !== null;
  }

  async startListening(
    onResult: (text: string, isFinal: boolean) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    if (this.isListening) return;

    try {
      if (!this.isInitialized) {
        await this.init();
      }

      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      this.recognizer = new this.model.KaldiRecognizer(16000);

      this.recognizer.on('result', (message: any) => {
        const text = message?.result?.text || message?.text;
        if (text && text.trim()) {
          onResult(text.trim(), true);
        }
      });

      this.recognizer.on('partialresult', (message: any) => {
        const partial = message?.result?.partial || message?.partial;
        if (partial && partial.trim()) {
          onResult(partial.trim(), false);
        }
      });

      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (e) => {
        if (!this.isListening || !this.recognizer) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }
        this.recognizer.acceptWaveform(int16Data);
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.isListening = true;
      console.log('[VoskRecognition] Started listening');
    } catch (error) {
      console.error('[VoskRecognition] Start error:', error);
      this.cleanup();
      if (onError) {
        onError(error instanceof Error ? error.message : 'Failed to start');
      }
    }
  }

  stopListening(): void {
    this.isListening = false;
    this.cleanup();
    console.log('[VoskRecognition] Stopped listening');
  }

  private cleanup(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.recognizer) {
      this.recognizer = null;
    }
  }

  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  async destroy(): Promise<void> {
    this.stopListening();
    if (this.model) {
      try {
        this.model.terminate();
      } catch {
      }
      this.model = null;
    }
    this.isInitialized = false;
    this.initPromise = null;
  }
}

export const voskRecognition = new VoskRecognitionService();
