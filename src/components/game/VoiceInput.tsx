import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { voiceRecognition } from '../../lib/voiceRecognition';
import { voiceCaller } from '../../lib/voiceCaller';
import { getLocale, t } from '../../lib/i18n';

const SUBMIT_HU = /(beküld|bekül|beküldés|beküldöm|küld|kül|küldés|küldöm|send|submit|mehet|mehetek|het|hetek|oké|okay|ok|oke|okés|go|kész|kesz|rendben|rajta|gyerünk|gyerunk|megy|indulhat|következő|kovetkezo|next)/i;
const SUBMIT_EN = /(send|submit|done|confirm|okay|ok|go|ready|next)/i;
const UNDO_HU = /\b(vissza|törlés|töröl|törölés|törles|törlöm|undo|delete|back|előző|elozo)\b/i;
const UNDO_EN = /\b(undo|back|delete|previous)\b/i;
const CLEAN_REGEX = /[.,!?;:]/g;

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
    const isHu = locale === 'hu';
    const cleanText = text.toLowerCase().trim().replace(CLEAN_REGEX, '');

    const submitPattern = isHu ? SUBMIT_HU : SUBMIT_EN;
    if (submitPattern.test(cleanText) && dartsCountRef.current > 0) {
      setLastRecognized(t('training.submit_darts'));
      onSubmitRef.current?.();
      setTimeout(() => setLastRecognized(''), 80);
      return true;
    }

    const undoPattern = isHu ? UNDO_HU : UNDO_EN;
    if (undoPattern.test(cleanText) && dartsCountRef.current > 0) {
      setLastRecognized(t('common.undo'));
      onUndoRef.current?.();
      setTimeout(() => setLastRecognized(''), 80);
      return true;
    }

    const results = voiceRecognition.parseMultipleTranscripts(text, locale);

    if (results.length > 0) {
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.isUndo) {
          if (dartsCountRef.current > 0) {
            setLastRecognized(t('common.undo'));
            onUndoRef.current?.();
          }
        } else {
          const display = result.multiplier === 0 ? 'Miss'
            : result.sector === 25 ? (result.multiplier === 2 ? 'Bull' : '25')
            : `${result.multiplier === 2 ? 'D' : result.multiplier === 3 ? 'T' : 'S'}${result.sector}`;

          setLastRecognized(display);
          onScoreInputRef.current(result.score, result.multiplier, result.sector);
        }
      }
      setTimeout(() => setLastRecognized(''), 80);
      return true;
    }
    return false;
  }, []);

  const startRecognition = useCallback(() => {
    if (isStartedRef.current) return;
    isStartedRef.current = true;

    voiceRecognition.startContinuousListening(
      (transcript, isFinal) => {
        if (isFinal) {
          const text = transcript.toLowerCase().trim();
          const locale = getLocale();
          const isHu = locale === 'hu';
          const cleanText = text.replace(CLEAN_REGEX, '');

          const submitPattern = isHu ? SUBMIT_HU : SUBMIT_EN;
          const undoPattern = isHu ? UNDO_HU : UNDO_EN;

          const isSubmitCommand = submitPattern.test(cleanText) && dartsCountRef.current > 0;
          if (isSubmitCommand || undoPattern.test(cleanText) || !pausedRef.current) {
            processTranscript(text);
          }
        } else if (!pausedRef.current) {
          setInterimText(transcript);
        }
      },
      () => {
        isStartedRef.current = false;
      }
    );
  }, [processTranscript]);

  useEffect(() => {
    if (autoStart && voiceEnabled && isAvailable) {
      voiceRecognition.stopListening();
      isStartedRef.current = false;
      setIsListening(false);

      const startNow = () => {
        setIsListening(true);
        setLastRecognized('');
        setInterimText('');
        startRecognition();
      };

      if (soundEnabled && voiceCaller.isSpeaking()) {
        const unsubscribe = voiceCaller.onSpeakingChange((isSpeaking) => {
          if (!isSpeaking) {
            unsubscribe();
            setTimeout(startNow, 50);
          }
        });
        return () => unsubscribe();
      }

      const timer = setTimeout(startNow, 30);
      return () => clearTimeout(timer);

    } else if ((!autoStart || !voiceEnabled) && isListening) {
      voiceRecognition.stopListening();
      setIsListening(false);
      setInterimText('');
      isStartedRef.current = false;
    }
  }, [autoStart, voiceEnabled, isAvailable, startRecognition, soundEnabled]);

  useEffect(() => {
    return () => {
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
