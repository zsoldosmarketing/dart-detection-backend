import { voiceRecognition } from './voiceRecognition';

class SoundEffectsService {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  playDartImpact() {
    if (!this.enabled || !this.audioContext) return;

    if (voiceRecognition.getIsListening()) {
      return;
    }

    const now = this.audioContext.currentTime;

    const oscillator = this.audioContext.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(200, now);
    oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.1);

    const noiseBuffer = this.audioContext.createBuffer(
      1,
      this.audioContext.sampleRate * 0.05,
      this.audioContext.sampleRate
    );
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = this.audioContext.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(800, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 0.05);

    const oscillatorGain = this.audioContext.createGain();
    oscillatorGain.gain.setValueAtTime(0.15, now);
    oscillatorGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    const masterGain = this.audioContext.createGain();
    masterGain.gain.setValueAtTime(0.4, now);

    oscillator.connect(oscillatorGain);
    oscillatorGain.connect(masterGain);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    masterGain.connect(this.audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.12);

    noiseSource.start(now);
    noiseSource.stop(now + 0.05);
  }

  playCheckout() {
    if (!this.enabled || !this.audioContext) return;

    const now = this.audioContext.currentTime;

    const frequencies = [523.25, 659.25, 783.99];

    frequencies.forEach((freq, index) => {
      const oscillator = this.audioContext!.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, now + index * 0.1);

      const gain = this.audioContext!.createGain();
      gain.gain.setValueAtTime(0, now + index * 0.1);
      gain.gain.linearRampToValueAtTime(0.2, now + index * 0.1 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + index * 0.1 + 0.3);

      oscillator.connect(gain);
      gain.connect(this.audioContext!.destination);

      oscillator.start(now + index * 0.1);
      oscillator.stop(now + index * 0.1 + 0.3);
    });
  }

  playBust() {
    if (!this.enabled || !this.audioContext) return;

    const now = this.audioContext.currentTime;

    const oscillator = this.audioContext.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(220, now);
    oscillator.frequency.exponentialRampToValueAtTime(55, now + 0.3);

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    oscillator.connect(gain);
    gain.connect(this.audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.3);
  }
}

export const soundEffects = new SoundEffectsService();
