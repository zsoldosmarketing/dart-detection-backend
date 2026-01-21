export interface CameraDevice {
  deviceId: string;
  label: string;
}

export interface CameraSettings {
  deviceId: string;
  width: number;
  height: number;
  frameRate: number;
  facingMode: 'user' | 'environment';
}

export interface CameraEventCallbacks {
  onDisconnect?: () => void;
  onReconnect?: () => void;
  onError?: (error: Error) => void;
}

const DEFAULT_SETTINGS: CameraSettings = {
  deviceId: '',
  width: 1920,
  height: 1080,
  frameRate: 30,
  facingMode: 'environment',
};

const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_ATTEMPTS = 5;

export class CameraManager {
  private stream: MediaStream | null = null;
  private settings: CameraSettings;
  private videoElement: HTMLVideoElement | null = null;
  private callbacks: CameraEventCallbacks = {};
  private reconnectAttempts = 0;
  private reconnectTimeout: number | null = null;
  private isReconnecting = false;
  private trackEndedHandler: (() => void) | null = null;

  constructor(settings: Partial<CameraSettings> = {}) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
  }

  setCallbacks(callbacks: CameraEventCallbacks): void {
    this.callbacks = callbacks;
  }

  async listDevices(): Promise<CameraDevice[]> {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter(d => d.kind === 'videoinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
        }));
    } catch {
      return [];
    }
  }

  async start(videoElement: HTMLVideoElement): Promise<boolean> {
    try {
      this.stopInternal(false);

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: (this.settings.deviceId && this.settings.deviceId.length > 0) ? { exact: this.settings.deviceId } : undefined,
          width: { ideal: this.settings.width },
          height: { ideal: this.settings.height },
          frameRate: { ideal: this.settings.frameRate },
          facingMode: (this.settings.deviceId && this.settings.deviceId.length > 0) ? undefined : this.settings.facingMode,
        },
        audio: false,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement = videoElement;
      videoElement.srcObject = this.stream;

      this.setupTrackMonitoring();

      await new Promise<void>((resolve, reject) => {
        videoElement.onloadedmetadata = () => {
          videoElement.play().then(() => resolve()).catch(reject);
        };
        videoElement.onerror = () => reject(new Error('Video element error'));
        setTimeout(() => reject(new Error('Video load timeout')), 10000);
      });

      this.reconnectAttempts = 0;
      this.isReconnecting = false;

      if (this.callbacks.onReconnect && this.reconnectAttempts > 0) {
        this.callbacks.onReconnect();
      }

      return true;
    } catch (error) {
      console.error('Camera start failed:', error);
      this.callbacks.onError?.(error instanceof Error ? error : new Error('Camera start failed'));
      return false;
    }
  }

  private setupTrackMonitoring(): void {
    if (!this.stream) return;

    const videoTrack = this.stream.getVideoTracks()[0];
    if (!videoTrack) return;

    this.trackEndedHandler = () => {
      console.log('Camera track ended, attempting reconnect...');
      this.handleDisconnect();
    };

    videoTrack.addEventListener('ended', this.trackEndedHandler);

    videoTrack.addEventListener('mute', () => {
      console.log('Camera track muted');
    });

    videoTrack.addEventListener('unmute', () => {
      console.log('Camera track unmuted');
    });
  }

  private handleDisconnect(): void {
    if (this.isReconnecting) return;

    this.callbacks.onDisconnect?.();
    this.attemptReconnect();
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('Max reconnect attempts reached');
      this.callbacks.onError?.(new Error('Kamera kapcsolat megszakadt, probalj ujracsatlakozni'));
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    console.log(`Reconnect attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);

    this.reconnectTimeout = window.setTimeout(async () => {
      if (this.videoElement) {
        const success = await this.start(this.videoElement);
        if (success) {
          console.log('Camera reconnected successfully');
          this.callbacks.onReconnect?.();
        } else {
          this.attemptReconnect();
        }
      }
      this.isReconnecting = false;
    }, RECONNECT_DELAY_MS);
  }

  private stopInternal(clearCallbacks: boolean): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.stream) {
      const videoTrack = this.stream.getVideoTracks()[0];
      if (videoTrack && this.trackEndedHandler) {
        videoTrack.removeEventListener('ended', this.trackEndedHandler);
      }
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      if (clearCallbacks) {
        this.videoElement = null;
      }
    }

    this.trackEndedHandler = null;
  }

  stop(): void {
    this.stopInternal(true);
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
  }

  isActive(): boolean {
    if (!this.stream || !this.stream.active) return false;
    const videoTrack = this.stream.getVideoTracks()[0];
    return videoTrack ? videoTrack.readyState === 'live' : false;
  }

  isReconnectingNow(): boolean {
    return this.isReconnecting;
  }

  setDevice(deviceId: string): void {
    this.settings.deviceId = deviceId;
  }

  setResolution(width: number, height: number): void {
    this.settings.width = width;
    this.settings.height = height;
  }

  getSettings(): CameraSettings {
    return { ...this.settings };
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  getActualResolution(): { width: number; height: number } | null {
    if (!this.videoElement) return null;
    return {
      width: this.videoElement.videoWidth,
      height: this.videoElement.videoHeight,
    };
  }

  async captureFrame(): Promise<ImageData | null> {
    if (!this.videoElement) return null;

    const canvas = document.createElement('canvas');
    canvas.width = this.videoElement.videoWidth;
    canvas.height = this.videoElement.videoHeight;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(this.videoElement, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  static async checkPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return result.state;
    } catch {
      return 'prompt';
    }
  }

  static async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }
}
