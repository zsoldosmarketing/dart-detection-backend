const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const STORAGE_URL = `${SUPABASE_URL}/storage/v1/object/public/offline-models`;

const PIPER_VOICE_URL = `${STORAGE_URL}/hu_HU-anna-medium.onnx`;
const PIPER_CONFIG_URL = `${STORAGE_URL}/hu_HU-anna-medium.onnx.json`;
const VOSK_MODEL_URL = `${STORAGE_URL}/vosk-model-small-en-us-0.15.zip`;
const PIPER_VOICE_SIZE = 63 * 1024 * 1024;
const VOSK_MODEL_SIZE = 40 * 1024 * 1024;

const DB_NAME = 'offline-speech-models';
const DB_VERSION = 1;
const STORE_NAME = 'models';

export type ModelType = 'piper-hu' | 'vosk-en';
export type DownloadStatus = 'not-downloaded' | 'downloading' | 'ready' | 'error';

export interface ModelInfo {
  type: ModelType;
  status: DownloadStatus;
  progress: number;
  size: number;
  error?: string;
}

class OfflineModelsManager {
  private db: IDBDatabase | null = null;
  private downloadListeners: Map<ModelType, Array<(info: ModelInfo) => void>> = new Map();
  private modelStatus: Map<ModelType, ModelInfo> = new Map();

  constructor() {
    this.modelStatus.set('piper-hu', {
      type: 'piper-hu',
      status: 'not-downloaded',
      progress: 0,
      size: PIPER_VOICE_SIZE
    });
    this.modelStatus.set('vosk-en', {
      type: 'vosk-en',
      status: 'not-downloaded',
      progress: 0,
      size: VOSK_MODEL_SIZE
    });
  }

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        this.checkExistingModels().then(resolve);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'type' });
        }
      };
    });
  }

  private async checkExistingModels(): Promise<void> {
    if (!this.db) return;

    const modelsToCheck: ModelType[] = ['piper-hu', 'vosk-en'];

    for (const modelType of modelsToCheck) {
      const transaction = this.db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(modelType);

      await new Promise<void>((resolve) => {
        request.onsuccess = () => {
          if (request.result?.data) {
            const info = this.modelStatus.get(modelType)!;
            info.status = 'ready';
            info.progress = 100;
            this.modelStatus.set(modelType, info);
          }
          resolve();
        };
        request.onerror = () => resolve();
      });
    }
  }

  getStatus(type: ModelType): ModelInfo {
    return this.modelStatus.get(type) || {
      type,
      status: 'not-downloaded',
      progress: 0,
      size: 0
    };
  }

  isReady(type: ModelType): boolean {
    return this.modelStatus.get(type)?.status === 'ready';
  }

  areAllReady(): boolean {
    return this.isReady('piper-hu') && this.isReady('vosk-en');
  }

  getTotalDownloadSize(): number {
    let total = 0;
    if (!this.isReady('piper-hu')) total += PIPER_VOICE_SIZE;
    if (!this.isReady('vosk-en')) total += VOSK_MODEL_SIZE;
    return total;
  }

  onProgress(type: ModelType, callback: (info: ModelInfo) => void): () => void {
    if (!this.downloadListeners.has(type)) {
      this.downloadListeners.set(type, []);
    }
    this.downloadListeners.get(type)!.push(callback);
    return () => {
      const listeners = this.downloadListeners.get(type);
      if (listeners) {
        const idx = listeners.indexOf(callback);
        if (idx > -1) listeners.splice(idx, 1);
      }
    };
  }

  private notifyProgress(type: ModelType, info: ModelInfo) {
    this.modelStatus.set(type, info);
    const listeners = this.downloadListeners.get(type) || [];
    listeners.forEach(cb => cb(info));
  }

  async downloadModel(type: ModelType): Promise<ArrayBuffer> {
    await this.init();

    const existing = await this.getModel(type);
    if (existing) {
      return existing;
    }

    const info = this.modelStatus.get(type)!;
    info.status = 'downloading';
    info.progress = 0;
    this.notifyProgress(type, info);

    const url = type === 'piper-hu' ? PIPER_VOICE_URL : VOSK_MODEL_URL;
    const defaultSize = type === 'piper-hu' ? PIPER_VOICE_SIZE : VOSK_MODEL_SIZE;

    try {
      console.log(`[OfflineModels] Downloading ${type} from storage...`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      const totalSize = contentLength ? parseInt(contentLength) : defaultSize;

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        const progress = Math.round((receivedLength / totalSize) * 100);
        info.progress = progress;
        this.notifyProgress(type, info);
      }

      const data = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        data.set(chunk, position);
        position += chunk.length;
      }

      await this.saveModel(type, data.buffer);

      if (type === 'piper-hu') {
        await this.downloadPiperConfig();
      }

      info.status = 'ready';
      info.progress = 100;
      this.notifyProgress(type, info);

      return data.buffer;
    } catch (error) {
      info.status = 'error';
      info.error = error instanceof Error ? error.message : 'Download failed';
      this.notifyProgress(type, info);
      throw error;
    }
  }

  private async downloadPiperConfig(): Promise<void> {
    try {
      const response = await fetch(PIPER_CONFIG_URL);
      if (!response.ok) return;

      const config = await response.json();
      await this.saveModelConfig('piper-hu-config', config);
    } catch {
      console.warn('[OfflineModels] Failed to download Piper config');
    }
  }

  private async saveModelConfig(key: string, config: unknown): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ type: key, config });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getModelConfig(key: string): Promise<unknown | null> {
    if (!this.db) await this.init();
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.config || null);
      request.onerror = () => resolve(null);
    });
  }

  private async saveModel(type: ModelType, data: ArrayBuffer): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ type, data });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getModel(type: ModelType): Promise<ArrayBuffer | null> {
    if (!this.db) await this.init();
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(type);
      request.onsuccess = () => resolve(request.result?.data || null);
      request.onerror = () => resolve(null);
    });
  }

  async deleteModel(type: ModelType): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(type);
      request.onsuccess = () => {
        const info = this.modelStatus.get(type)!;
        info.status = 'not-downloaded';
        info.progress = 0;
        this.notifyProgress(type, info);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteAllModels(): Promise<void> {
    await this.deleteModel('piper-hu');
    await this.deleteModel('vosk-en');
    if (this.db) {
      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete('piper-hu-config');
    }
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}

export const offlineModels = new OfflineModelsManager();
