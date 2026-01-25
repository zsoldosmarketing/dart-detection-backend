import { offlineModels } from './offlineModels';

declare global {
  interface Window {
    createPiper?: (config: any) => Promise<any>;
    ort?: any;
  }
}

const ONNX_RUNTIME_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/ort.min.js';
const PIPER_PHONEMIZE_URL = 'https://cdn.jsdelivr.net/npm/piper-phonemize@1.0.0/dist/piper-phonemize.min.js';

interface PiperConfig {
  sample_rate: number;
  num_speakers: number;
  speaker_id_map?: Record<string, number>;
  phoneme_type?: string;
}

class PiperTTSService {
  private session: any = null;
  private config: PiperConfig | null = null;
  private audioContext: AudioContext | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private isSpeaking = false;
  private speakingListeners: Array<(isSpeaking: boolean) => void> = [];
  private currentSource: AudioBufferSourceNode | null = null;
  private volume = 0.85;

  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    try {
      await this.loadDependencies();

      const modelData = await offlineModels.getModel('piper-hu');
      if (!modelData) {
        throw new Error('Piper model not downloaded');
      }

      const config = await offlineModels.getModelConfig('piper-hu-config');
      if (config) {
        this.config = config;
      } else {
        this.config = {
          sample_rate: 22050,
          num_speakers: 1
        };
      }

      console.log('[PiperTTS] Loading ONNX model...');
      this.session = await window.ort.InferenceSession.create(
        modelData,
        {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all'
        }
      );
      console.log('[PiperTTS] Model loaded');

      this.audioContext = new AudioContext();
      this.isInitialized = true;
    } catch (error) {
      console.error('[PiperTTS] Init error:', error);
      this.initPromise = null;
      throw error;
    }
  }

  private async loadDependencies(): Promise<void> {
    if (!window.ort) {
      await this.loadScript(ONNX_RUNTIME_URL);
      console.log('[PiperTTS] ONNX Runtime loaded');
    }
  }

  private loadScript(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${url}"]`);
      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = url;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${url}`));
      document.head.appendChild(script);
    });
  }

  isAvailable(): boolean {
    return offlineModels.isReady('piper-hu');
  }

  isReady(): boolean {
    return this.isInitialized && this.session !== null;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  onSpeakingChange(callback: (isSpeaking: boolean) => void): () => void {
    this.speakingListeners.push(callback);
    return () => {
      this.speakingListeners = this.speakingListeners.filter(cb => cb !== callback);
    };
  }

  private notifySpeaking(isSpeaking: boolean): void {
    this.isSpeaking = isSpeaking;
    this.speakingListeners.forEach(cb => cb(isSpeaking));
  }

  async speak(text: string): Promise<void> {
    if (!text.trim()) return;

    try {
      if (!this.isInitialized) {
        await this.init();
      }

      if (!this.session || !this.audioContext) {
        console.error('[PiperTTS] Not initialized');
        return;
      }

      this.stop();
      this.notifySpeaking(true);

      const phonemeIds = this.textToPhonemeIds(text);

      const inputTensor = new window.ort.Tensor(
        'int64',
        BigInt64Array.from(phonemeIds.map(id => BigInt(id))),
        [1, phonemeIds.length]
      );

      const inputLengths = new window.ort.Tensor(
        'int64',
        BigInt64Array.from([BigInt(phonemeIds.length)]),
        [1]
      );

      const scales = new window.ort.Tensor(
        'float32',
        new Float32Array([0.667, 1.0, 0.8]),
        [3]
      );

      const feeds: Record<string, any> = {
        input: inputTensor,
        input_lengths: inputLengths,
        scales: scales
      };

      if (this.config && this.config.num_speakers > 1) {
        feeds.sid = new window.ort.Tensor(
          'int64',
          BigInt64Array.from([BigInt(0)]),
          [1]
        );
      }

      const results = await this.session.run(feeds);
      const audioData = results.output.data as Float32Array;

      await this.playAudio(audioData);
    } catch (error) {
      console.error('[PiperTTS] Speak error:', error);
      this.notifySpeaking(false);
    }
  }

  private textToPhonemeIds(text: string): number[] {
    const PHONEME_MAP: Record<string, number> = {
      ' ': 3,
      'a': 4, 'á': 5, 'b': 6, 'c': 7, 'd': 8, 'e': 9, 'é': 10,
      'f': 11, 'g': 12, 'h': 13, 'i': 14, 'í': 15, 'j': 16, 'k': 17,
      'l': 18, 'm': 19, 'n': 20, 'o': 21, 'ó': 22, 'ö': 23, 'ő': 24,
      'p': 25, 'r': 26, 's': 27, 't': 28, 'u': 29, 'ú': 30, 'ü': 31,
      'ű': 32, 'v': 33, 'w': 34, 'x': 35, 'y': 36, 'z': 37,
      '.': 38, ',': 39, '!': 40, '?': 41, '-': 42,
      'cs': 43, 'gy': 44, 'ly': 45, 'ny': 46, 'sz': 47, 'ty': 48, 'zs': 49,
      '0': 50, '1': 51, '2': 52, '3': 53, '4': 54, '5': 55, '6': 56,
      '7': 57, '8': 58, '9': 59
    };

    const BOS = 1;
    const EOS = 2;
    const PAD = 0;

    const normalized = text.toLowerCase()
      .replace(/[^\wáéíóöőúüű.,!?\-\s]/g, '')
      .trim();

    const ids: number[] = [BOS];

    let i = 0;
    while (i < normalized.length) {
      if (i + 1 < normalized.length) {
        const digraph = normalized.slice(i, i + 2);
        if (PHONEME_MAP[digraph] !== undefined) {
          ids.push(PHONEME_MAP[digraph]);
          ids.push(PAD);
          i += 2;
          continue;
        }
      }

      const char = normalized[i];
      const id = PHONEME_MAP[char];
      if (id !== undefined) {
        ids.push(id);
        ids.push(PAD);
      }
      i++;
    }

    ids.push(EOS);

    return ids;
  }

  private async playAudio(audioData: Float32Array): Promise<void> {
    if (!this.audioContext) return;

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const sampleRate = this.config?.sample_rate || 22050;
    const buffer = this.audioContext.createBuffer(1, audioData.length, sampleRate);
    buffer.copyToChannel(audioData, 0);

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = this.volume;

    this.currentSource = this.audioContext.createBufferSource();
    this.currentSource.buffer = buffer;
    this.currentSource.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    this.currentSource.onended = () => {
      this.currentSource = null;
      this.notifySpeaking(false);
    };

    this.currentSource.start();
  }

  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {}
      this.currentSource = null;
    }
    this.notifySpeaking(false);
  }

  isSpeakingNow(): boolean {
    return this.isSpeaking;
  }

  async destroy(): Promise<void> {
    this.stop();
    if (this.session) {
      this.session = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    this.isInitialized = false;
    this.initPromise = null;
  }
}

export const piperTTS = new PiperTTSService();
