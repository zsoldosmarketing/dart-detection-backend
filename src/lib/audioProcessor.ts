export interface AudioProcessorConfig {
  noiseGateThreshold: number;
  enabled: boolean;
}

class AudioProcessorService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private destinationStream: MediaStreamAudioDestinationNode | null = null;
  private config: AudioProcessorConfig = {
    noiseGateThreshold: -50,
    enabled: true,
  };
  private animationFrameId: number | null = null;

  async initialize(config?: Partial<AudioProcessorConfig>): Promise<MediaStream> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (!this.config.enabled) {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return this.mediaStream;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.audioContext = new AudioContext();
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyserNode = this.audioContext.createAnalyser();
      this.gainNode = this.audioContext.createGain();
      this.destinationStream = this.audioContext.createMediaStreamDestination();

      this.analyserNode.fftSize = 2048;
      this.analyserNode.smoothingTimeConstant = 0.8;

      this.sourceNode.connect(this.analyserNode);
      this.analyserNode.connect(this.gainNode);
      this.gainNode.connect(this.destinationStream);

      this.startNoiseGate();

      return this.destinationStream.stream;
    } catch (error) {
      console.error('Failed to initialize audio processor:', error);
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return this.mediaStream;
    }
  }

  private startNoiseGate(): void {
    if (!this.analyserNode || !this.gainNode) return;

    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkLevel = () => {
      if (!this.analyserNode || !this.gainNode) return;

      this.analyserNode.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;

      const dbLevel = 20 * Math.log10(average / 255);

      if (dbLevel < this.config.noiseGateThreshold) {
        this.gainNode.gain.setTargetAtTime(0, this.audioContext!.currentTime, 0.01);
      } else {
        this.gainNode.gain.setTargetAtTime(1, this.audioContext!.currentTime, 0.01);
      }

      this.animationFrameId = requestAnimationFrame(checkLevel);
    };

    checkLevel();
  }

  setNoiseGateThreshold(threshold: number): void {
    this.config.noiseGateThreshold = threshold;
  }

  getNoiseGateThreshold(): number {
    return this.config.noiseGateThreshold;
  }

  async cleanup(): Promise<void> {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.destinationStream) {
      this.destinationStream.disconnect();
      this.destinationStream = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }

  isInitialized(): boolean {
    return this.audioContext !== null || this.mediaStream !== null;
  }
}

export const audioProcessor = new AudioProcessorService();
