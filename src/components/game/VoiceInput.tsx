import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { voiceRecognition } from '../../lib/voiceRecognition';
import { voiceCaller } from '../../lib/voiceCaller';
import { getLocale, t } from '../../lib/i18n';

interface VoiceInputProps {
  onScoreInput: (score: number, multiplier: number, sector: number | null) => void;
  onUndo?: () => void;
  onSubmit?: () => void;
  disabled?: boolean;
  paused?: boolean;
  autoStart?: boolean;
  dartsCount?: number;
  voiceEnabled?: boolean;
  onToggleVoice?: () => void;
  soundEnabled?: boolean;
}

export function VoiceInput({ onScoreInput, onUndo, onSubmit, disabled, paused, autoStart, dartsCount = 0, voiceEnabled = false, onToggleVoice, soundEnabled = true }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [lastRecognized, setLastRecognized] = useState('');
  const [interimText, setInterimText] = useState('');
  const isAvailable = voiceRecognition.isAvailable();

  const onScoreInputRef = useRef(onScoreInput);
  const onUndoRef = useRef(onUndo);
  const onSubmitRef = useRef(onSubmit);
  const pausedRef = useRef(paused);
  const dartsCountRef = useRef(dartsCount);
  const isStartedRef = useRef(false);

  useEffect(() => {
    onScoreInputRef.current = onScoreInput;
    onUndoRef.current = onUndo;
    onSubmitRef.current = onSubmit;
    pausedRef.current = paused;
    dartsCountRef.current = dartsCount;
  }, [onScoreInput, onUndo, onSubmit, paused, dartsCount]);

  const processTranscript = useCallback((text: string) => {
    const locale = getLocale();
    const cleanText = text.toLowerCase().trim().replace(/[.,!?;:]/g, '');

    const submitPattern = locale === 'hu'
      ? /(beküld|bekül|beküldés|beküldöm|küld|kül|küldés|küldöm|send|submit|mehet|mehetek|het|hetek|oké|okay|ok|oke|okés|go|kész|kesz|rendben|rajta|gyerünk|gyerunk|megy|indulhat|következő|kovetkezo|next)/i
      : /(send|submit|done|confirm|okay|ok|go|ready|next)/i;

    if (submitPattern.test(cleanText) && dartsCountRef.current > 0) {
      setLastRecognized(t('training.submit_darts'));
      if (onSubmitRef.current) {
        onSubmitRef.current();
      }
      setTimeout(() => setLastRecognized(''), 200);
      return true;
    }

    const undoPattern = locale === 'hu'
      ? /\b(vissza|törlés|töröl|törölés|törles|törlöm|undo|delete|back|előző|elozo)\b/i
      : /\b(undo|back|delete|previous)\b/i;

    if (undoPattern.test(cleanText) && dartsCountRef.current > 0) {
      setLastRecognized(t('common.undo'));
      if (onUndoRef.current) {
        onUndoRef.current();
      }
      setTimeout(() => setLastRecognized(''), 200);
      return true;
    }

    const results = voiceRecognition.parseMultipleTranscripts(text, locale);

    if (results.length > 0) {
      results.forEach((result) => {
        if (result.isUndo) {
          if (dartsCountRef.current > 0) {
            setLastRecognized(t('common.undo'));
            if (onUndoRef.current) {
              onUndoRef.current();
            }
            setTimeout(() => setLastRecognized(''), 200);
          }
        } else {
          let display = '';
          if (result.multiplier === 0) {
            display = 'Miss';
          } else if (result.sector === 25) {
            display = result.multiplier === 2 ? 'Bull' : '25';
          } else {
            const mult = result.multiplier === 2 ? 'D' : result.multiplier === 3 ? 'T' : 'S';
            display = `${mult}${result.sector}`;
          }

          setLastRecognized(display);
          onScoreInputRef.current(result.score, result.multiplier, result.sector);
          setTimeout(() => setLastRecognized(''), 200);
        }
      });

      return true;
    }
    return false;
  }, []);

  const startRecognition = useCallback(() => {
    if (isStartedRef.current) {
      console.log('[VoiceInput] Already started, skipping');
      return;
    }

    console.log('[VoiceInput] Starting continuous recognition (always-on mode)');
    isStartedRef.current = true;

    voiceRecognition.startContinuousListening(
      (transcript, isFinal) => {
        if (isFinal) {
          const text = transcript.toLowerCase().trim();

          const locale = getLocale();
          const cleanText = text.replace(/[.,!?;:]/g, '');
          const submitPattern = locale === 'hu'
            ? /(beküld|bekül|beküldés|beküldöm|küld|kül|küldés|küldöm|send|submit|mehet|mehetek|het|hetek|oké|okay|ok|oke|okés|go|kész|kesz|rendben|rajta|gyerünk|gyerunk|megy|indulhat)/i
            : /(send|submit|done|confirm|okay|ok|go|ready)/i;
          const undoPattern = locale === 'hu'
            ? /\b(vissza|törlés|töröl|törölés|törles|törlöm|undo|delete|back|előző|elozo)\b/i
            : /\b(undo|back|delete|previous)\b/i;

          const isSubmitCommand = submitPattern.test(cleanText) && dartsCountRef.current > 0;
          if (isSubmitCommand || undoPattern.test(cleanText) || !pausedRef.current) {
            processTranscript(text);
          }
        } else {
          if (!pausedRef.current) {
            setInterimText(transcript);
          }
        }
      },
      (error) => {
        console.error('[VoiceInput] Voice error:', error);
        isStartedRef.current = false;
      }
    );
  }, [processTranscript]);

  useEffect(() => {
    console.log('[VoiceInput] Main effect triggered', {
      autoStart,
      voiceEnabled,
      isAvailable,
      isListening,
      isStarted: isStartedRef.current,
      soundEnabled,
      speakerIsSpeaking: voiceCaller.isSpeaking()
    });

    if (autoStart && voiceEnabled && isAvailable) {
      console.log('[VoiceInput] Should start recognition...');

      // Először teljesen leállítjuk ha futna
      voiceRecognition.stopListening();
      isStartedRef.current = false;
      setIsListening(false);

      const startNow = () => {
        console.log('[VoiceInput] Starting recognition now');
        setIsListening(true);
        setLastRecognized('');
        setInterimText('');
        startRecognition();
      };

      // Ha a speaker beszél ÉS a soundEnabled = true, várunk amíg befejezi
      // Ha soundEnabled = false, akkor nincs speaker beszéd, azonnal indítunk
      if (soundEnabled && voiceCaller.isSpeaking()) {
        console.log('[VoiceInput] Speaker is speaking, waiting for finish...');
        const unsubscribe = voiceCaller.onSpeakingChange((isSpeaking) => {
          if (!isSpeaking) {
            console.log('[VoiceInput] Speaker finished, now starting recognition');
            unsubscribe();
            setTimeout(startNow, 200);
          }
        });
        return () => unsubscribe();
      }

      // Kis késleltetés hogy a stop biztosan lefusson
      const timer = setTimeout(startNow, 100);
      return () => clearTimeout(timer);

    } else if ((!autoStart || !voiceEnabled) && isListening) {
      console.log('[VoiceInput] Stopping recognition (disabled or not my turn)');
      voiceRecognition.stopListening();
      setIsListening(false);
      setInterimText('');
      isStartedRef.current = false;
    }
  }, [autoStart, voiceEnabled, isAvailable, startRecognition, soundEnabled]);

  useEffect(() => {
    return () => {
      console.log('[VoiceInput] Unmounting - stopping recognition');
      voiceRecognition.stopListening();
      isStartedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (disabled) {
      voiceRecognition.stopListening();
      setIsListening(false);
      setInterimText('');
      isStartedRef.current = false;
    }
  }, [disabled]);

  // A speaker pause/resume törlése - ne zavarjuk a felhasználó beszédét
  // amikor a speaker visszamond dobásokat

  useEffect(() => {
    if (paused) {
      setInterimText('');
    }
  }, [paused]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      voiceRecognition.stopListening();
      setIsListening(false);
      setInterimText('');
      isStartedRef.current = false;
      if (onToggleVoice && voiceEnabled) {
        onToggleVoice();
      }
    } else {
      setIsListening(true);
      setLastRecognized('');
      setInterimText('');
      startRecognition();
      if (onToggleVoice && !voiceEnabled) {
        onToggleVoice();
      }
    }
  }, [isListening, startRecognition, onToggleVoice, voiceEnabled]);

  if (!isAvailable) {
    return null;
  }

  return (
    <button
      onClick={toggleListening}
      disabled={disabled}
      className={`p-2 rounded-lg transition-all ${
        isListening
          ? 'bg-red-500 text-white'
          : 'bg-dark-700 hover:bg-dark-600 text-white'
      } disabled:opacity-30`}
      title={isListening ? t('training.stop_listening') : t('training.start_listening')}
    >
      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </button>
  );
}
