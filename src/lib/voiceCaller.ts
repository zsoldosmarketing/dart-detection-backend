import { getLocale, onLocaleChange } from './i18n';
import { voiceSettingsSync } from './voiceSettingsSync';

export interface CallerSettings {
  enabled: boolean;
  voice: string;
  voiceName?: string;
  voiceLang?: string;
  volume: number;
  language: string;
}

function getDefaultSettings(): CallerSettings {
  const locale = getLocale();
  return {
    enabled: false,
    voice: 'default',
    volume: 0.85,
    language: locale === 'hu' ? 'hu-HU' : 'en-GB',
  };
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

class VoiceCaller {
  private settings: CallerSettings = getDefaultSettings();
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private initialized = false;
  private lastScore = 0;
  private consecutiveHighScores = 0;
  private speakingListeners: Array<(isSpeaking: boolean) => void> = [];
  private currentlySpeaking = false;
  private settingsInitialized = false;

  constructor() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      this.synth.onvoiceschanged = () => {
        this.loadVoices();
        console.log('[VoiceCaller] Hangok frissítve, magyar hangok:',
          this.voices.filter(v => v.lang.toLowerCase().startsWith('hu')).map(v => ({ name: v.name, lang: v.lang }))
        );
      };

      this.initializeSettings();

      onLocaleChange(() => {
        this.updateLanguage();
      });

      voiceSettingsSync.onSettingsChange((settings) => {
        console.log('[VoiceCaller] Beállítások szinkronizálva:', settings);
        this.settings = {
          ...this.settings,
          voice: settings.voice_id,
          voiceName: settings.voice_name,
          voiceLang: settings.voice_lang,
          volume: settings.volume,
          language: settings.language
        };
        console.log('[VoiceCaller] ✓ Preferált hang:', { name: settings.voice_name, lang: settings.voice_lang });
      });

      setTimeout(() => {
        if (this.voices.length === 0) {
          this.loadVoices();
        }
      }, 500);
    }
  }

  private async initializeSettings() {
    if (this.settingsInitialized) return;
    this.settingsInitialized = true;

    const settings = await voiceSettingsSync.loadSettings();
    if (settings) {
      this.settings = {
        ...this.settings,
        voice: settings.voice_id,
        voiceName: settings.voice_name,
        voiceLang: settings.voice_lang,
        volume: settings.volume,
        language: settings.language
      };
      console.log('[VoiceCaller] Kezdeti beállítások:', this.settings);
      console.log('[VoiceCaller] ✓ Preferált hang:', { name: settings.voice_name, lang: settings.voice_lang });
    }
  }

  onSpeakingChange(callback: (isSpeaking: boolean) => void) {
    this.speakingListeners.push(callback);
    return () => {
      this.speakingListeners = this.speakingListeners.filter(cb => cb !== callback);
    };
  }

  private notifySpeaking(isSpeaking: boolean) {
    this.speakingListeners.forEach(cb => cb(isSpeaking));
  }

  private loadVoices() {
    if (this.synth) {
      this.voices = this.synth.getVoices();
      this.initialized = true;
      console.log('[VoiceCaller] Összes betöltött hang:', this.voices.length);

      const locale = getLocale();
      if (locale === 'hu') {
        const huVoices = this.voices.filter(v =>
          v.lang.toLowerCase().startsWith('hu') ||
          v.lang.includes('HU') ||
          v.lang.includes('hu')
        );
        if (huVoices.length > 0) {
          console.log('[VoiceCaller] ✓ Telepített magyar hangok:', huVoices.map(v => ({ name: v.name, lang: v.lang })));
        } else {
          console.warn('[VoiceCaller] ⚠️ FIGYELEM: Nincs magyar hang telepítve!');
          console.log('[VoiceCaller] Elérhető első 10 hang:', this.voices.slice(0, 10).map(v => ({ name: v.name, lang: v.lang })));
        }
      }
    }
  }

  getAvailableVoices(): { id: string; name: string; lang: string }[] {
    return this.voices.map((v) => ({
      id: v.voiceURI,
      name: v.name,
      lang: v.lang,
    }));
  }

  async setSettings(settings: Partial<CallerSettings>) {
    this.settings = { ...this.settings, ...settings };

    const selectedVoice = settings.voice && settings.voice !== 'default'
      ? this.voices.find(v => v.voiceURI === settings.voice)
      : null;

    await voiceSettingsSync.saveSettings({
      voice_enabled: settings.enabled ?? this.settings.enabled,
      voice_id: settings.voice ?? this.settings.voice,
      voice_name: selectedVoice?.name ?? settings.voiceName,
      voice_lang: selectedVoice?.lang ?? settings.voiceLang,
      volume: settings.volume ?? this.settings.volume,
      language: settings.language ?? this.settings.language
    });

    console.log('[VoiceCaller] ✓ Hang beállítás mentve:', {
      id: settings.voice,
      name: selectedVoice?.name,
      lang: selectedVoice?.lang
    });
  }

  getSettings(): CallerSettings {
    return this.settings;
  }

  updateLanguage(): void {
    const locale = getLocale();
    this.settings.language = locale === 'hu' ? 'hu-HU' : 'en-GB';

    if (this.synth && this.synth.speaking) {
      this.synth.cancel();
    }
  }

  private getVoice(): SpeechSynthesisVoice | null {
    const locale = getLocale();

    if (this.settings.voice !== 'default') {
      const exactVoice = this.voices.find((v) => v.voiceURI === this.settings.voice);
      if (exactVoice) {
        console.log('[VoiceCaller] ✓ Pontos hang találat (URI):', exactVoice.name, exactVoice.lang);
        return exactVoice;
      }
    }

    if (this.settings.voiceName) {
      const nameMatch = this.voices.find(v => v.name === this.settings.voiceName);
      if (nameMatch) {
        console.log('[VoiceCaller] ✓ Hang találat (név alapján):', nameMatch.name, nameMatch.lang);
        return nameMatch;
      }

      const partialNameMatch = this.voices.find(v =>
        v.name.toLowerCase().includes(this.settings.voiceName!.toLowerCase()) &&
        v.lang.toLowerCase().startsWith(locale)
      );
      if (partialNameMatch) {
        console.log('[VoiceCaller] ✓ Hang találat (részleges név):', partialNameMatch.name, partialNameMatch.lang);
        return partialNameMatch;
      }
    }

    const HUNGARIAN_VOICE_PRIORITY = [
      'Google magyar',
      'Microsoft Szabolcs',
      'hu-HU-Noemi',
      'Melina',
      'Eszter',
      'Hungarian',
      'Magyar',
    ];

    const isMaleVoice = (v: SpeechSynthesisVoice) => {
      const name = v.name.toLowerCase();
      const isFemale = name.includes('female') || name.includes('woman') ||
        name.includes('zira') || name.includes('samantha') || name.includes('karen') ||
        name.includes('moira') || name.includes('tessa') || name.includes('fiona') ||
        name.includes('victoria') || name.includes('agnes') || name.includes('nora') ||
        name.includes('siri') || name.includes('anna') || name.includes('martha') ||
        name.includes('julia') || name.includes('emily') || name.includes('kate') ||
        name.includes('catherine') || name.includes('serena') || name.includes('luciana') ||
        name.includes('paulina') || name.includes('amelie') || name.includes('melina') ||
        name.includes('eszter') || name.includes('noemi');
      const isMale = name.includes('male') || name.includes('man') ||
        name.includes('david') || name.includes('daniel') || name.includes('james') ||
        name.includes('mark') || name.includes('tom') || name.includes('alex') ||
        name.includes('george') || name.includes('oliver') || name.includes('gordon') ||
        name.includes('martin') || name.includes('thomas') || name.includes('rishi') ||
        name.includes('arthur') || name.includes('reed') || name.includes('eddy') ||
        name.includes('fred') || name.includes('albert') || name.includes('boris') ||
        name.includes('ralph') || name.includes('lee') || name.includes('sandy') ||
        name.includes('aaron') || name.includes('nathan') || name.includes('rocko') ||
        name.includes('szabolcs');
      return isMale || !isFemale;
    };

    if (locale === 'hu') {
      const huVoices = this.voices.filter(v =>
        v.lang.toLowerCase().startsWith('hu') || v.lang.includes('HU')
      );

      console.log('[VoiceCaller] Elérhető magyar hangok:', huVoices.map(v => ({ name: v.name, lang: v.lang, male: isMaleVoice(v) })));

      for (const priorityName of HUNGARIAN_VOICE_PRIORITY) {
        const voice = huVoices.find(v =>
          v.name.toLowerCase().includes(priorityName.toLowerCase())
        );
        if (voice) {
          console.log('[VoiceCaller] ✓ Prioritási listából választva:', voice.name, voice.lang);
          return voice;
        }
      }

      const huMaleVoice = huVoices.find(v => isMaleVoice(v));
      if (huMaleVoice) {
        console.log('[VoiceCaller] ✓ Magyar férfi hang:', huMaleVoice.name, huMaleVoice.lang);
        return huMaleVoice;
      }

      if (huVoices.length > 0) {
        console.log('[VoiceCaller] ✓ Első magyar hang:', huVoices[0].name, huVoices[0].lang);
        return huVoices[0];
      }

      console.error('[VoiceCaller] ⚠️ NINCS MAGYAR HANG TELEPÍTVE!');
      console.error('[VoiceCaller] Telepítés: Rendszer > Beállítások > Nyelv > Magyar nyelv hozzáadása > Szövegfelolvasás letöltése');

      const anyEnVoice = this.voices.find(v => v.lang.startsWith('en'));
      if (anyEnVoice) {
        console.warn('[VoiceCaller] Fallback angol hangra:', anyEnVoice.name);
        return anyEnVoice;
      }

      if (this.voices.length > 0) {
        console.warn('[VoiceCaller] Fallback első elérhető hangra:', this.voices[0].name);
        return this.voices[0];
      }

      return null;
    }

    const gbMaleVoice = this.voices.find(v =>
      v.lang === 'en-GB' && isMaleVoice(v)
    );
    if (gbMaleVoice) {
      console.log('[VoiceCaller] GB férfi hang:', gbMaleVoice.name);
      return gbMaleVoice;
    }

    const gbVoice = this.voices.find(v => v.lang === 'en-GB');
    if (gbVoice) {
      console.log('[VoiceCaller] GB hang:', gbVoice.name);
      return gbVoice;
    }

    const usMaleVoice = this.voices.find(v =>
      v.lang === 'en-US' && isMaleVoice(v)
    );
    if (usMaleVoice) {
      console.log('[VoiceCaller] US férfi hang:', usMaleVoice.name);
      return usMaleVoice;
    }

    const anyEnVoice = this.voices.find(v => v.lang.startsWith('en'));
    if (anyEnVoice) {
      console.log('[VoiceCaller] Angol hang:', anyEnVoice.name);
      return anyEnVoice;
    }

    return this.voices[0] || null;
  }

  private formatNameForSpeech(name: string): string {
    if (!name) return name;
    if (name === name.toUpperCase() && name.length > 1) {
      return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    }
    return name;
  }

  async speak(text: string, priority: 'high' | 'normal' = 'normal', rate = 0.78) {
    if (!this.settings.enabled || !this.synth) return;

    const locale = getLocale();

    if (this.voices.length === 0) {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const maxWaitTime = isMobile ? 2500 : 1500;

      await new Promise<void>(resolve => {
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            this.loadVoices();
            console.log('[VoiceCaller] Hangok betöltve (timeout után):', this.voices.length, 'hang');
            resolve();
          }
        }, maxWaitTime);

        const handler = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            this.loadVoices();
            console.log('[VoiceCaller] Hangok betöltve (voiceschanged event):', this.voices.length, 'hang');
            resolve();
          }
        };

        if (this.synth) {
          this.synth.onvoiceschanged = handler;
          this.synth.getVoices();
        }
      });
    }

    const voice = this.getVoice();

    if (!voice) {
      console.error('[VoiceCaller] HIBA: Nincs hang elérhető!', {
        locale,
        availableVoices: this.voices.length,
        text: text.substring(0, 50)
      });
      if (this.voices.length > 0) {
        console.log('[VoiceCaller] Első 3 elérhető hang:', this.voices.slice(0, 3).map(v => ({ name: v.name, lang: v.lang })));
      }
      return;
    }

    console.log('[VoiceCaller] speak() használt hang:', { name: voice.name, lang: voice.lang, text, forcedLang: locale === 'hu' ? 'hu-HU' : 'en-GB' });

    if (priority === 'high') {
      this.synth.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = this.settings.volume;
    utterance.rate = rate;
    utterance.pitch = 0.85;
    utterance.voice = voice;
    utterance.lang = locale === 'hu' ? 'hu-HU' : 'en-GB';

    utterance.onstart = () => {
      this.currentlySpeaking = true;
      this.notifySpeaking(true);
    };

    utterance.onend = () => {
      const checkSpeaking = () => {
        if (this.synth && this.synth.speaking) {
          setTimeout(checkSpeaking, 30);
        } else {
          setTimeout(() => {
            this.currentlySpeaking = false;
            this.notifySpeaking(false);
          }, 1500);
        }
      };
      checkSpeaking();
    };

    utterance.onerror = () => {
      this.currentlySpeaking = false;
      this.notifySpeaking(false);
    };

    this.currentlySpeaking = true;
    this.notifySpeaking(true);

    this.synth.speak(utterance);
  }

  callGameOn(playerName?: string) {
    const locale = getLocale();
    const formattedName = playerName ? this.formatNameForSpeech(playerName) : undefined;
    if (locale === 'hu') {
      const phrases = formattedName
        ? [`Következik ${formattedName}, játék!`, `Dobóvonalhoz ${formattedName}, kezdi!`, `És dobhat ${formattedName}, nyit!`]
        : ['Játék!', 'Induljunk!', 'Kezdjük!'];
      this.speak(randomPick(phrases), 'high', 0.78);
    } else {
      const phrases = formattedName
        ? [`${formattedName} to throw, game on!`, `${formattedName} to the oche, game on!`]
        : ['Game on!', 'Play!'];
      this.speak(randomPick(phrases), 'high', 0.8);
    }
  }

  callScore(score: number) {
    const locale = getLocale();

    if (score === 180) {
      this.consecutiveHighScores++;
      if (locale === 'hu') {
        this.speak('Szááááz-nyolcvaaan!', 'high', 0.60);
      } else {
        this.speak('Oneee hundred and eiiiiighty!', 'high', 0.80);
      }
      return;
    }

    if (score >= 140) {
      this.consecutiveHighScores++;
      const scoreWord = this.numberToWords(score);
      if (locale === 'hu') {
        const phrases = [
          `${scoreWord}!`,
          `Gyönyörű! ${scoreWord}!`,
          `Nagyszerű! ${scoreWord}!`
        ];
        this.speak(randomPick(phrases), 'high', 0.7);
      } else {
        const phrases = [
          `${scoreWord}!`,
          `Lovely darts! ${scoreWord}!`,
          `Very nice! ${scoreWord}!`
        ];
        this.speak(randomPick(phrases), 'high', 0.88);
      }
      return;
    }

    if (score >= 100) {
      const scoreWord = this.numberToWords(score);
      if (locale === 'hu') {
        this.speak(scoreWord, 'normal', 0.75);
      } else {
        this.speak(scoreWord, 'normal', 0.9);
      }
      return;
    }

    if (score === 0) {
      this.consecutiveHighScores = 0;
      if (locale === 'hu') {
        const phrases = ['Nincs pont', 'Nulla', 'Semmi'];
        this.speak(randomPick(phrases));
      } else {
        const phrases = ['No score', 'Nothing', 'Zero'];
        this.speak(randomPick(phrases));
      }
      return;
    }

    if (score <= 20) {
      this.consecutiveHighScores = 0;
    }

    this.speak(this.numberToWords(score));
    this.lastScore = score;
  }

  callCheckout(score: number) {
    const locale = getLocale();
    const scoreWord = this.numberToWords(score);

    if (score === 170) {
      if (locale === 'hu') {
        this.speak('Maximum! Százhetven!', 'high', 0.68);
      } else {
        this.speak('Maximum checkout! One hundred and seventy!', 'high', 0.72);
      }
      return;
    }

    if (score >= 100) {
      if (locale === 'hu') {
        const phrases = [
          `Kiszállt! ${scoreWord}!`,
          `Nagyszerű! ${scoreWord}!`,
          `És kiszáll! ${scoreWord}!`
        ];
        this.speak(randomPick(phrases), 'high', 0.7);
      } else {
        const phrases = [
          `Checkout! ${scoreWord}!`,
          `Beautiful checkout! ${scoreWord}!`,
          `Lovely finish! ${scoreWord}!`
        ];
        this.speak(randomPick(phrases), 'high', 0.74);
      }
      return;
    }

    if (locale === 'hu') {
      this.speak(`Kiszállt! ${scoreWord}!`, 'high', 0.72);
    } else {
      this.speak(`Checkout! ${scoreWord}!`, 'high', 0.76);
    }
  }

  callGameShot(playerName?: string) {
    const locale = getLocale();
    const formattedName = playerName ? this.formatNameForSpeech(playerName) : undefined;
    if (locale === 'hu') {
      if (formattedName) {
        const phrases = [
          `Győzelem! ${formattedName} nyert!`,
          `${formattedName} megnyerte!`,
          `${formattedName}... győzelem!`
        ];
        this.speak(randomPick(phrases), 'high', 0.7);
      } else {
        this.speak('Győzelem!', 'high', 0.7);
      }
    } else {
      if (formattedName) {
        const phrases = [
          `Game shot! ${formattedName} wins!`,
          `And ${formattedName} takes it!`,
          `${formattedName} wins the match!`
        ];
        this.speak(randomPick(phrases), 'high', 0.74);
      } else {
        this.speak('Game shot!', 'high', 0.74);
      }
    }
  }

  callLegWon(playerName?: string, legsWon?: number) {
    const locale = getLocale();
    const formattedName = playerName ? this.formatNameForSpeech(playerName) : undefined;
    if (locale === 'hu') {
      if (formattedName && legsWon !== undefined) {
        const phrases = [
          `A leg ${formattedName}é! ${legsWon} leg.`,
          `${formattedName} nyerte! ${legsWon} leg.`,
          `${formattedName}! ${legsWon} leg.`
        ];
        this.speak(randomPick(phrases), 'high', 0.72);
      } else {
        this.speak('És a leg!', 'high', 0.72);
      }
    } else {
      if (formattedName && legsWon !== undefined) {
        const phrases = [
          `Leg! ${formattedName}, ${legsWon} legs.`,
          `${formattedName} takes the leg! ${legsWon} legs.`,
          `Game shot and the leg! ${formattedName}!`
        ];
        this.speak(randomPick(phrases), 'high', 0.76);
      } else {
        this.speak('Game shot and the leg!', 'high', 0.76);
      }
    }
  }

  callSetWon(playerName?: string, setsWon?: number) {
    const locale = getLocale();
    const formattedName = playerName ? this.formatNameForSpeech(playerName) : undefined;
    if (locale === 'hu') {
      if (formattedName && setsWon !== undefined) {
        this.speak(`Szett! ${formattedName}, ${setsWon} szett.`, 'high', 0.9);
      } else {
        this.speak('Szett!', 'high');
      }
    } else {
      if (formattedName && setsWon !== undefined) {
        this.speak(`Set! ${formattedName}, ${setsWon} sets.`, 'high', 0.9);
      } else {
        this.speak('Game shot and the set!', 'high');
      }
    }
  }

  callBust() {
    const locale = getLocale();
    if (locale === 'hu') {
      const phrases = ['Túldobás!', 'Átlépte!', 'Buszt!'];
      this.speak(randomPick(phrases), 'normal', 0.78);
    } else {
      const phrases = ['Bust!', 'No score, bust!', 'Over!'];
      this.speak(randomPick(phrases), 'normal', 0.78);
    }
  }

  callRequires(remaining: number) {
    const locale = getLocale();
    const scoreWord = this.numberToWords(remaining);
    if (locale === 'hu') {
      this.speak(`Kell ${scoreWord}`, 'normal', 0.72);
    } else {
      this.speak(`You require ${scoreWord}`, 'normal', 0.78);
    }
  }

  callYouRequire(remaining: number, playerName?: string) {
    const locale = getLocale();
    const scoreWord = this.numberToWords(remaining);
    const name = playerName ? this.formatNameForSpeech(playerName) : (locale === 'hu' ? 'Te' : 'You');

    if (locale === 'hu') {
      const suffix = this.getHungarianDativeSuffix(name);
      this.speak(`${name}${suffix} maradt ${scoreWord}`, 'normal', 0.8);
    } else {
      this.speak(`${name}, you require ${scoreWord}`, 'normal', 0.82);
    }
  }

  callMatchDart() {
    const locale = getLocale();
    if (locale === 'hu') {
      const phrases = ['Meccsnyíl!', 'Ez most a győzelemért!', 'Lehetőség a meccsre!'];
      this.speak(randomPick(phrases), 'high', 0.76);
    } else {
      const phrases = ['Match dart!', 'This is for the match!', 'Match darts!'];
      this.speak(randomPick(phrases), 'high', 0.76);
    }
  }

  callDouble(number: number) {
    const locale = getLocale();
    if (number === 20) {
      if (locale === 'hu') {
        const phrases = ['Dupla húsz!', 'Tops!', 'Dupla teteje!'];
        this.speak(randomPick(phrases));
      } else {
        const phrases = ['Double top!', 'Tops!', 'Double twenty!'];
        this.speak(randomPick(phrases));
      }
    } else if (number === 16) {
      if (locale === 'hu') {
        this.speak('Dupla tizenhat!');
      } else {
        this.speak('Double sixteen!');
      }
    } else if (number === 8) {
      if (locale === 'hu') {
        this.speak('Dupla nyolc!');
      } else {
        this.speak('Double eight!');
      }
    } else {
      if (locale === 'hu') {
        this.speak(`Dupla ${this.numberToWords(number)}!`);
      } else {
        this.speak(`Double ${number}!`);
      }
    }
  }

  callTriple(number: number) {
    const locale = getLocale();
    if (number === 20) {
      if (locale === 'hu') {
        const phrases = ['Tripla húsz!', 'Hatvan!', 'Tripla teteje!'];
        this.speak(randomPick(phrases));
      } else {
        const phrases = ['Treble twenty!', 'Sixty!', 'Triple top!'];
        this.speak(randomPick(phrases));
      }
    } else if (number === 19) {
      if (locale === 'hu') {
        this.speak('Tripla tizenkilenc!');
      } else {
        this.speak('Treble nineteen!');
      }
    } else if (number === 18) {
      if (locale === 'hu') {
        this.speak('Tripla tizennyolc!');
      } else {
        this.speak('Treble eighteen!');
      }
    } else {
      if (locale === 'hu') {
        this.speak(`Tripla ${this.numberToWords(number)}!`);
      } else {
        this.speak(`Treble ${number}!`);
      }
    }
  }

  callBullseye() {
    const locale = getLocale();
    if (locale === 'hu') {
      const phrases = ['Közép!', 'Bullszáj!', 'Bika szem!', 'Ötven!'];
      this.speak(randomPick(phrases), 'high');
    } else {
      const phrases = ['Bullseye!', 'Bull!', 'Fifty!'];
      this.speak(randomPick(phrases), 'high');
    }
  }

  callSingleBull() {
    const locale = getLocale();
    if (locale === 'hu') {
      const phrases = ['Huszonöt!', 'Külső közép!', 'Kis bull!'];
      this.speak(randomPick(phrases));
    } else {
      const phrases = ['Twenty five!', 'Outer bull!', 'Single bull!'];
      this.speak(randomPick(phrases));
    }
  }

  callTurnChange(playerName: string | undefined, remaining: number) {
    const locale = getLocale();
    const scoreWord = this.numberToWords(remaining);
    const name = playerName ? this.formatNameForSpeech(playerName) : (locale === 'hu' ? 'Te' : 'You');

    if (locale === 'hu') {
      setTimeout(() => {
        const suffix = this.getHungarianDativeSuffix(name);
        this.speak(`${name}${suffix} maradt ${scoreWord}`, 'normal', 0.8);
      }, 800);
    } else {
      setTimeout(() => {
        this.speak(`${name}, you require ${scoreWord}`, 'normal', 0.82);
      }, 800);
    }
  }

  callCricketNumber(number: number, marks: number) {
    const locale = getLocale();
    if (marks === 3) {
      if (locale === 'hu') {
        this.speak(`${number} lezárva!`, 'high');
      } else {
        this.speak(`${number} closed!`, 'high');
      }
    } else {
      if (locale === 'hu') {
        this.speak(`${number}, ${marks} jel`);
      } else {
        this.speak(`${number}, ${marks} mark${marks > 1 ? 's' : ''}`);
      }
    }
  }

  callKill(playerName: string) {
    const locale = getLocale();
    const formattedName = this.formatNameForSpeech(playerName);
    if (locale === 'hu') {
      this.speak(`${formattedName} megölve!`, 'high');
    } else {
      this.speak(`${formattedName} killed!`, 'high');
    }
  }

  callEliminated(playerName: string) {
    const locale = getLocale();
    const formattedName = this.formatNameForSpeech(playerName);
    if (locale === 'hu') {
      this.speak(`${formattedName} kiesett!`, 'high');
    } else {
      this.speak(`${formattedName} eliminated!`, 'high');
    }
  }

  callShanghai() {
    const locale = getLocale();
    if (locale === 'hu') {
      this.speak('Sanghaj! Azonnali győzelem!', 'high', 0.85);
    } else {
      this.speak('Shanghai! Instant win!', 'high', 0.85);
    }
  }

  callNiceDarts() {
    const locale = getLocale();
    if (locale === 'hu') {
      const phrases = ['Szép dobás!', 'Remek!', 'Nagyszerű!'];
      this.speak(randomPick(phrases));
    } else {
      const phrases = ['Nice darts!', 'Lovely!', 'Well played!'];
      this.speak(randomPick(phrases));
    }
  }

  callDart(score: number, target: any) {
    if (typeof target === 'string') {
      this.speak(target);
      return;
    }
    if (target.type === 'miss') {
      const locale = getLocale();
      if (locale === 'hu') {
        const phrases = ['Mellé', 'Semmi'];
        this.speak(randomPick(phrases));
      } else {
        const phrases = ['Miss', 'Outside'];
        this.speak(randomPick(phrases));
      }
    } else if (target.type === 'double-bull') {
      this.callBullseye();
    } else if (target.type === 'single-bull') {
      this.callSingleBull();
    } else if (target.type === 'double') {
      this.callDouble(target.sector);
    } else if (target.type === 'triple') {
      this.callTriple(target.sector);
    } else {
      this.speak(String(score));
    }
  }

  isSpeaking(): boolean {
    return this.currentlySpeaking || this.synth?.speaking || false;
  }

  private getHungarianDativeSuffix(name: string): string {
    if (!name) return 'nak';

    const lowercaseName = name.toLowerCase();

    if (lowercaseName.endsWith('ék')) {
      return 'nak';
    }

    if (lowercaseName.endsWith('ak') || lowercaseName.endsWith('ok')) {
      return 'nak';
    }

    if (lowercaseName.endsWith('ek') || lowercaseName.endsWith('ök')) {
      return 'nek';
    }

    const backVowels = ['a', 'á', 'o', 'ó', 'u', 'ú'];
    const frontVowels = ['e', 'é', 'i', 'í', 'ö', 'ő', 'ü', 'ű'];

    for (let i = lowercaseName.length - 1; i >= 0; i--) {
      const char = lowercaseName[i];
      if (backVowels.includes(char)) {
        return 'nak';
      }
      if (frontVowels.includes(char)) {
        return 'nek';
      }
    }

    return 'nak';
  }

  private numberToWords(num: number): string {
    const locale = getLocale();
    return locale === 'hu' ? this.numberToWordsHu(num) : this.numberToWordsEn(num);
  }

  private numberToWordsEn(num: number): string {
    if (num === 0) return 'zero';
    if (num === 180) return 'one hundred and eighty';

    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
      'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    if (num < 20) return ones[num];
    if (num < 100) {
      const t = Math.floor(num / 10);
      const o = num % 10;
      return o === 0 ? tens[t] : `${tens[t]} ${ones[o]}`;
    }

    const h = Math.floor(num / 100);
    const remainder = num % 100;
    if (remainder === 0) {
      return `${ones[h]} hundred`;
    }
    return `${ones[h]} hundred and ${this.numberToWordsEn(remainder)}`;
  }

  private numberToWordsHu(num: number): string {
    if (num === 0) return 'nulla';
    if (num === 180) return 'száznyolcvan';

    const ones = ['', 'egy', 'kettő', 'három', 'négy', 'öt', 'hat', 'hét', 'nyolc', 'kilenc'];
    const teens = ['tíz', 'tizenegy', 'tizenkettő', 'tizenhárom', 'tizennégy', 'tizenöt',
      'tizenhat', 'tizenhét', 'tizennyolc', 'tizenkilenc'];
    const tens = ['', '', 'húszon', 'harminc', 'negyven', 'ötven', 'hatvan', 'hetven', 'nyolcvan', 'kilencven'];
    const tensRound = ['', 'tíz', 'húsz', 'harminc', 'negyven', 'ötven', 'hatvan', 'hetven', 'nyolcvan', 'kilencven'];

    if (num < 10) return ones[num];
    if (num >= 10 && num < 20) return teens[num - 10];
    if (num < 100) {
      const t = Math.floor(num / 10);
      const o = num % 10;
      return o === 0 ? tensRound[t] : `${tens[t]}${ones[o]}`;
    }

    const h = Math.floor(num / 100);
    const remainder = num % 100;
    const hundredWord = h === 1 ? 'száz' : `${ones[h]}száz`;
    if (remainder === 0) {
      return hundredWord;
    }
    return `${hundredWord}${this.numberToWordsHu(remainder)}`;
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
      this.currentlySpeaking = false;
      this.notifySpeaking(false);
    }
  }
}

export const voiceCaller = new VoiceCaller();
