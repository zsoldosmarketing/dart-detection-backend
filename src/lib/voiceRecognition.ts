import { getLocale, onLocaleChange } from './i18n';
import { audioProcessor } from './audioProcessor';
import { voiceSettingsSync } from './voiceSettingsSync';

export interface VoiceRecognitionResult {
  score: number;
  multiplier: number;
  sector: number | null;
  isUndo?: boolean;
}

export type RecognitionMode = 'fast' | 'balanced' | 'accurate';

class VoiceRecognitionService {
  private recognition: any = null;
  private isListening = false;
  private isPaused = false;
  private mode: RecognitionMode = 'balanced';
  private initialized = false;
  private currentCallback: ((transcript: string, isFinal: boolean) => void) | null = null;
  private restartAttempts = 0;
  private maxRestartAttempts = 10;
  private restartTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 3;

        const locale = getLocale();
        const lang = locale === 'hu' ? 'hu-HU' : 'en-GB';
        this.recognition.lang = lang;

        console.log('[VoiceRecognition] Inicializálva:', { locale, lang, userAgent: navigator.userAgent.substring(0, 80) });

        this.initializeSettings();

        onLocaleChange(() => {
          this.updateLanguage();
        });

        voiceSettingsSync.onSettingsChange((settings) => {
          console.log('[VoiceRecognition] Beállítások szinkronizálva:', settings);
          this.mode = settings.recognition_mode;
          this.updateLanguage();
        });
      }
    }
  }

  private async initializeSettings() {
    if (this.initialized) return;
    this.initialized = true;

    const settings = await voiceSettingsSync.loadSettings();
    if (settings) {
      this.mode = settings.recognition_mode;
      console.log('[VoiceRecognition] Kezdeti beállítások:', { mode: this.mode, minConfidence: settings.min_confidence });
    }
  }

  isAvailable(): boolean {
    return this.recognition !== null;
  }

  startListening(
    onResult: (result: VoiceRecognitionResult) => void,
    onError?: (error: string) => void
  ): void {
    if (!this.recognition) return;

    if (this.isListening) {
      return;
    }

    const locale = getLocale();
    const lang = locale === 'hu' ? 'hu-HU' : 'en-GB';
    this.recognition.lang = lang;
    this.recognition.continuous = false;
    this.recognition.interimResults = false;

    console.log('[VoiceRecognition] startListening:', { locale, lang });

    this.recognition.onresult = (event: any) => {
      this.isListening = false;
      const lastResult = event.results[event.results.length - 1];
      if (!lastResult) return;

      const confidence = lastResult[0].confidence || 1.0;
      const minConfidence = this.getMinConfidence();

      if (confidence < minConfidence) {
        return;
      }

      const transcript = lastResult[0].transcript.toLowerCase().trim();
      console.log('[VoiceRecognition] Transcript:', transcript, 'Confidence:', confidence);
      const result = this.parseTranscript(transcript, locale);
      console.log('[VoiceRecognition] Result:', result);

      if (result) {
        onResult(result);
      } else if (onError) {
        onError('Not recognized');
      }
    };

    this.recognition.onerror = (event: any) => {
      this.isListening = false;
      if (onError && event.error !== 'aborted') {
        onError(event.error);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
    };

    try {
      this.recognition.stop();
    } catch {
      // ignore
    }

    setTimeout(() => {
      try {
        this.isListening = true;
        this.recognition.start();
      } catch {
        this.isListening = false;
        if (onError) {
          onError('Could not start');
        }
      }
    }, 50);
  }

  startContinuousListening(
    onTranscript: (transcript: string, isFinal: boolean) => void,
    onError?: (error: string) => void
  ): void {
    if (!this.recognition) return;

    this.currentCallback = onTranscript;
    this.isPaused = false;

    if (this.isListening) {
      console.log('[VoiceRecognition] Already listening, just updating callback');
      return;
    }

    const ensureCorrectLanguage = () => {
      if (!this.recognition) return;
      const currentLocale = getLocale();
      const expectedLang = currentLocale === 'hu' ? 'hu-HU' : 'en-GB';
      this.recognition.lang = expectedLang;
    };

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    ensureCorrectLanguage();
    this.recognition.continuous = !isMobile;
    this.recognition.interimResults = !isMobile;

    this.recognition.onresult = (event: any) => {
      this.restartAttempts = 0;

      if (this.isPaused) {
        return;
      }

      const minConfidence = this.getMinConfidence();

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const confidence = event.results[i][0].confidence || 1.0;
        const transcript = event.results[i][0].transcript;
        const isFinal = event.results[i].isFinal;

        console.log('[VoiceRecognition] onresult:', { transcript, isFinal, confidence, paused: this.isPaused });

        if (event.results[i].isFinal && confidence < minConfidence) {
          continue;
        }

        if (this.currentCallback && !this.isPaused) {
          this.currentCallback(transcript, isFinal);
        }
      }
    };

    this.recognition.onerror = (event: any) => {
      console.log('[VoiceRecognition] onerror:', event.error);
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      if (event.error === 'audio-capture' || event.error === 'not-allowed') {
        this.isListening = false;
        if (this.restartTimeout) {
          clearTimeout(this.restartTimeout);
          this.restartTimeout = null;
        }
        if (onError) {
          onError(event.error);
        }
        return;
      }
      if (event.error === 'network') {
        this.restartAttempts++;
      }
    };

    this.recognition.onend = () => {
      console.log('[VoiceRecognition] onend, isListening:', this.isListening, 'attempts:', this.restartAttempts);

      if (!this.isListening) {
        return;
      }

      if (this.restartAttempts < this.maxRestartAttempts) {
        if (this.restartTimeout) {
          clearTimeout(this.restartTimeout);
        }
        const delay = isMobile ? 150 : 50;
        this.restartTimeout = setTimeout(() => {
          if (this.isListening) {
            try {
              ensureCorrectLanguage();
              this.recognition.start();
              console.log('[VoiceRecognition] Restarted');
            } catch {
              this.restartAttempts++;
            }
          }
        }, delay);
      } else {
        console.log('[VoiceRecognition] Max attempts reached, resetting...');
        this.restartAttempts = 0;
        setTimeout(() => {
          if (this.isListening) {
            try {
              ensureCorrectLanguage();
              this.recognition.start();
            } catch {
              this.isListening = false;
            }
          }
        }, 500);
      }
    };

    try {
      this.recognition.stop();
    } catch {
      // ignore
    }

    setTimeout(() => {
      try {
        this.isListening = true;
        this.restartAttempts = 0;
        ensureCorrectLanguage();
        this.recognition.start();
        console.log('[VoiceRecognition] Started continuous listening');
      } catch {
        this.isListening = false;
      }
    }, 100);
  }

  pauseListening(): void {
    console.log('[VoiceRecognition] Paused');
    this.isPaused = true;
  }

  resumeListening(): void {
    console.log('[VoiceRecognition] Resumed');
    this.isPaused = false;
  }

  isPausedState(): boolean {
    return this.isPaused;
  }

  stopListening(): void {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
  }

  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  updateLanguage(): void {
    if (!this.recognition) return;

    const locale = getLocale();
    const lang = locale === 'hu' ? 'hu-HU' : 'en-GB';
    this.recognition.lang = lang;

    console.log('[VoiceRecognition] Nyelv frissítve:', { locale, lang });

    if (this.isListening) {
      const wasListening = this.isListening;
      this.stopListening();

      if (wasListening) {
        setTimeout(() => {
          this.isListening = true;
          try {
            this.recognition.lang = lang;
            this.recognition.start();
          } catch {
            this.isListening = false;
          }
        }, 100);
      }
    }
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  getMinConfidence(): number {
    if (typeof window === 'undefined') return this.getModeConfidence();
    const stored = localStorage.getItem('voiceMinConfidence');
    return stored ? parseFloat(stored) : this.getModeConfidence();
  }

  async setMinConfidence(value: number): Promise<void> {
    await voiceSettingsSync.saveSettings({
      min_confidence: value
    });

    if (typeof window !== 'undefined') {
      localStorage.setItem('voiceMinConfidence', value.toString());
    }
  }

  getMode(): RecognitionMode {
    if (typeof window === 'undefined') return 'balanced';
    const stored = localStorage.getItem('voiceRecognitionMode') as RecognitionMode;
    return stored || this.mode;
  }

  async setMode(mode: RecognitionMode): Promise<void> {
    this.mode = mode;
    const confidence = this.getModeConfidence();

    await voiceSettingsSync.saveSettings({
      recognition_mode: mode,
      min_confidence: confidence
    });

    if (typeof window !== 'undefined') {
      localStorage.setItem('voiceRecognitionMode', mode);
      localStorage.setItem('voiceMinConfidence', confidence.toString());
    }
  }

  private getModeConfidence(): number {
    const currentMode = this.getMode();
    switch (currentMode) {
      case 'fast':
        return 0.3;
      case 'balanced':
        return 0.6;
      case 'accurate':
        return 0.8;
      default:
        return 0.6;
    }
  }

  parseTranscript(transcript: string, locale: string): VoiceRecognitionResult | null {
    return locale === 'hu'
      ? this.parseHungarian(transcript)
      : this.parseEnglish(transcript);
  }

  parseMultipleTranscripts(transcript: string, locale: string): VoiceRecognitionResult[] {
    const undoPattern = locale === 'hu'
      ? /^(vissza|törlés|töröl|törölés|törles|undo|delete|back)$/i
      : /^(undo|back|delete)$/i;

    if (undoPattern.test(transcript.trim())) {
      return [{ score: 0, multiplier: 0, sector: null, isUndo: true }];
    }

    const hasBullKeyword = locale === 'hu'
      ? /\b(bull|közép|kozep|bika|ötven|otven|huszonöt|huszonot|huszon öt|huszon ot|kisbull|kis bull|külső bull|kulso bull|nagybull|nagy bull|dupla bull|duplabull|belső bull|belso bull|szimpla bull|sima bull|50|25)\b/i.test(transcript)
      : /\b(bull|bullseye|double bull|single bull|small bull|outer bull|fifty|twenty.?five|50|25)\b/i.test(transcript);

    transcript = this.splitInvalidNumbers(transcript, hasBullKeyword);

    const compoundPattern = locale === 'hu'
      ? /(?:dupla|tripla)\s+(?:egy|kettő|ketto|két|ket|három|harom|négy|negy|öt|ot|hat|hét|het|nyolc|kilenc|tíz|tiz|tizenegy|tizenkettő|tizenketto|tizenhárom|tizenharom|tizennégy|tizennegy|tizenöt|tizenot|tizenhat|tizenhét|tizenhet|tizennyolc|tizenkilenc|húsz|husz|20|\d+)/gi
      : /(?:double|triple|dub|trip|treble)\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|\d+)/gi;

    const simplePattern = locale === 'hu'
      ? /(?:miss|mellé|melle|nulla|nula|nolla|nullát|nullat|semmi|zero|külső bull|kulso bull|dupla bull|duplabull|nagybull|nagy bull|belső bull|belso bull|szimpla bull|sima bull|bull|kisbull|kis bull|közép|kozep|bika|ötven|otven|huszonöt|huszonot|huszon öt|huszon ot|húsz|husz|tizenkilenc|tizennyolc|tizenhét|tizenhet|tizenhat|tizenöt|tizenot|tizennégy|tizennegy|tizenhárom|tizenharom|tizenkettő|tizenketto|tizenegy|egy|kettő|ketto|két|ket|három|harom|négy|negy|ötös|otos|öt|ot|hat|hét|het|nyolc|kilenc|tíz|tiz|\d+)/gi
      : /(?:miss|missed|zero|nought|nothing|double bull|bullseye|bull|single bull|small bull|outer bull|fifty|twenty five|twentyfive|nineteen|eighteen|seventeen|sixteen|fifteen|fourteen|thirteen|twelve|eleven|ones|twos|threes|fours|fives|sixes|sevens|eights|nines|tens|one|two|three|four|five|six|seven|eight|nine|ten|twenty|\d+)/gi;

    const coveredRanges: Array<[number, number]> = [];
    const results: Array<{ result: VoiceRecognitionResult; index: number }> = [];

    const compoundMatches = transcript.matchAll(compoundPattern);
    for (const match of compoundMatches) {
      const result = this.parseTranscript(match[0], locale);
      if (result && match.index !== undefined) {
        results.push({ result, index: match.index });
        coveredRanges.push([match.index, match.index + match[0].length]);
      }
    }

    const simpleMatches = transcript.matchAll(simplePattern);
    for (const match of simpleMatches) {
      if (match.index === undefined) continue;
      const matchStart = match.index;
      const matchEnd = match.index + match[0].length;
      const isCovered = coveredRanges.some(([start, end]) => matchStart >= start && matchEnd <= end);
      if (!isCovered) {
        const result = this.parseTranscript(match[0], locale);
        if (result) {
          results.push({ result, index: matchStart });
        }
      }
    }

    results.sort((a, b) => a.index - b.index);

    return results.map(r => r.result);
  }

  private splitInvalidNumbers(transcript: string, preserveBullNumbers: boolean = false): string {
    return transcript.replace(/\b(\d{2,})\b/g, (match) => {
      const num = parseInt(match);

      if ((num === 25 || num === 50) && preserveBullNumbers) {
        return match;
      }

      if (num >= 21 && num <= 99) {
        const tens = Math.floor(num / 10);
        const ones = num % 10;

        if (tens >= 1 && tens <= 20 && ones >= 1 && ones <= 20) {
          return `${tens} ${ones}`;
        }

        if (tens >= 1 && tens <= 20 && ones === 0) {
          return `${tens}`;
        }
      }

      if (num >= 100) {
        const digits = match.split('');
        const parts: string[] = [];
        let i = 0;

        while (i < digits.length) {
          if (digits[i] === '0') {
            parts.push('0');
            i++;
            continue;
          }

          if (i + 1 < digits.length) {
            const twoDigit = parseInt(digits[i] + digits[i + 1]);
            if (twoDigit >= 1 && twoDigit <= 20) {
              parts.push(twoDigit.toString());
              i += 2;
              continue;
            }
          }

          const oneDigit = parseInt(digits[i]);
          if (oneDigit >= 1 && oneDigit <= 20) {
            parts.push(oneDigit.toString());
          }
          i++;
        }

        return parts.length > 0 ? parts.join(' ') : match;
      }

      return match;
    });
  }

  private parseEnglish(text: string): VoiceRecognitionResult | null {
    text = text.toLowerCase().replace(/[.,!?]/g, '').trim();

    if (/^(undo|back|delete)$/.test(text)) {
      return { score: 0, multiplier: 0, sector: null, isUndo: true };
    }

    if (/(miss|missed|zero)/.test(text) || text === '0') {
      return { score: 0, multiplier: 0, sector: null };
    }

    if (/\b(50|fifty)\b/.test(text) || /^(50|fifty)$/.test(text)) {
      return { score: 50, multiplier: 2, sector: 25 };
    }

    if (/\b(25|twenty five|twentyfive)\b/.test(text) || /^(25|twenty five|twentyfive)$/.test(text)) {
      return { score: 25, multiplier: 1, sector: 25 };
    }

    if (/\b(bull|bullseye|double bull)\b/.test(text) || /^(bull|bullseye|double bull)$/.test(text)) {
      return { score: 50, multiplier: 2, sector: 25 };
    }

    if (/\b(single bull|small bull)\b/.test(text) || /^(single bull|small bull)$/.test(text)) {
      return { score: 25, multiplier: 1, sector: 25 };
    }

    let multiplier = 1;
    if (text.includes('double') || text.includes('dub')) {
      multiplier = 2;
    } else if (text.includes('triple') || text.includes('treble') || text.includes('trip')) {
      multiplier = 3;
    }

    const numberMap: Record<string, number> = {
      'zero': 0, 'one': 1, 'ones': 1, 'two': 2, 'twos': 2, 'three': 3, 'threes': 3,
      'four': 4, 'fours': 4, 'five': 5, 'fives': 5, 'six': 6, 'sixes': 6,
      'seven': 7, 'sevens': 7, 'eight': 8, 'eights': 8, 'nine': 9, 'nines': 9,
      'ten': 10, 'tens': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13,
      'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17,
      'eighteen': 18, 'nineteen': 19, 'twenty': 20,
    };

    let sector: number | null = null;
    for (const [word, num] of Object.entries(numberMap)) {
      if (text.includes(word)) {
        sector = num;
        break;
      }
    }

    const digitMatch = text.match(/\b(\d+)\b/);
    if (digitMatch) {
      sector = parseInt(digitMatch[1]);
    }

    if (sector !== null && sector >= 1 && sector <= 20) {
      const score = sector * multiplier;
      return { score, multiplier, sector };
    }

    return null;
  }

  private parseHungarian(text: string): VoiceRecognitionResult | null {
    text = text.toLowerCase().replace(/[.,!?]/g, '').trim();
    console.log('[parseHungarian] Input text:', text);

    if (/^(vissza|törlés|töröl|törölés|törles|törlöm|undo|delete|back|előző|elozo)$/.test(text)) {
      console.log('[parseHungarian] Undo detected');
      return { score: 0, multiplier: 0, sector: null, isUndo: true };
    }

    if (/(miss|mellé|melle|nulla|nula|nolla|nullát|nullat|semmi|zero)/.test(text) || text === '0') {
      console.log('[parseHungarian] Miss/Zero detected');
      return { score: 0, multiplier: 0, sector: null };
    }

    if (/(kisbull|kis\s+bull|kicsi\s+bull|külső\s+bull|kulso\s+bull|szimpla\s+bull|sima\s+bull|outer\s+bull)/i.test(text)) {
      return { score: 25, multiplier: 1, sector: 25 };
    }

    if (/\b(25|huszonöt|huszonot|huszon öt|huszon ot)\b/.test(text)) {
      return { score: 25, multiplier: 1, sector: 25 };
    }

    if (/(nagybull|nagy\s+bull|dupla\s+bull|duplabull|belső\s+bull|belso\s+bull|\bbull\b|közép|kozep|bika)/i.test(text)) {
      return { score: 50, multiplier: 2, sector: 25 };
    }

    if (/\b(50|ötven|otven)\b/.test(text)) {
      return { score: 50, multiplier: 2, sector: 25 };
    }

    let multiplier = 1;
    if (/dupla|duplá/.test(text)) {
      multiplier = 2;
    } else if (/tripla|triplá/.test(text)) {
      multiplier = 3;
    }

    const numberPatterns: Array<[RegExp, number]> = [
      [/húsz|husz/i, 20],
      [/tizenkilenc/i, 19],
      [/tizennyolc/i, 18],
      [/tizenhét|tizenhet/i, 17],
      [/tizenhat/i, 16],
      [/tizenöt|tizenot/i, 15],
      [/tizennégy|tizennegy/i, 14],
      [/tizenhárom|tizenharom/i, 13],
      [/tizenkettő|tizenketto|tizenkét|tizenket/i, 12],
      [/tizenegy/i, 11],
      [/tíz|tiz/i, 10],
      [/kilenc/i, 9],
      [/nyolc/i, 8],
      [/hét|het/i, 7],
      [/hat/i, 6],
      [/ötös|otos|öt|ot/i, 5],
      [/négy|negy/i, 4],
      [/három|harom/i, 3],
      [/kettő|ketto|két|ket/i, 2],
      [/egy/i, 1],
    ];

    let sector: number | null = null;

    for (const [pattern, num] of numberPatterns) {
      if (pattern.test(text)) {
        sector = num;
        console.log('[parseHungarian] Matched pattern:', pattern, 'Number:', num);
        break;
      }
    }

    if (sector === null) {
      const digitMatch = text.match(/(\d+)/);
      if (digitMatch) {
        const num = parseInt(digitMatch[1]);
        if (num >= 0 && num <= 20) {
          sector = num === 0 ? null : num;
          console.log('[parseHungarian] Matched digit:', num);
        }
      }
    }

    if (sector !== null && sector >= 1 && sector <= 20) {
      const score = sector * multiplier;
      console.log('[parseHungarian] Final result:', { score, multiplier, sector });
      return { score, multiplier, sector };
    }

    console.log('[parseHungarian] No match found');
    return null;
  }
}

export const voiceRecognition = new VoiceRecognitionService();
