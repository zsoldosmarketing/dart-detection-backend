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
}

export function VoiceInput({ onScoreInput, onUndo, onSubmit, disabled, paused, autoStart, dartsCount = 0, voiceEnabled = false }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [lastRecognized, setLastRecognized] = useState('');
  const [interimText, setInterimText] = useState('');
  const [speakerActive, setSpeakerActive] = useState(false);
  const [manuallyControlled, setManuallyControlled] = useState(false);
  const isAvailable = voiceRecognition.isAvailable();
  const onScoreInputRef = useRef(onScoreInput);
  const onUndoRef = useRef(onUndo);
  const onSubmitRef = useRef(onSubmit);
  const pausedRef = useRef(paused);
  const dartsCountRef = useRef(dartsCount);
  const speakerActiveRef = useRef(speakerActive);
  const pendingTranscriptRef = useRef<string | null>(null);
  const lastInterimRef = useRef<string>('');
  const isRestartingRef = useRef(false);
  const lastStartTimeRef = useRef<number>(0);

  useEffect(() => {
    onScoreInputRef.current = onScoreInput;
    onUndoRef.current = onUndo;
    onSubmitRef.current = onSubmit;
    pausedRef.current = paused;
    dartsCountRef.current = dartsCount;
    speakerActiveRef.current = speakerActive;
  }, [onScoreInput, onUndo, onSubmit, paused, dartsCount, speakerActive]);

  useEffect(() => {
    if (paused && !pausedRef.current && isListening) {
      setInterimText('');
    }
  }, [paused, isListening]);

  useEffect(() => {
    if (disabled && isListening) {
      voiceRecognition.stopListening();
      setIsListening(false);
      setInterimText('');
      setManuallyControlled(false);
    }
  }, [disabled, isListening]);

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
          if (dartsCountRef.current >= 3) {
            return;
          }

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
    const now = Date.now();
    if (now - lastStartTimeRef.current < 500) {
      return;
    }
    lastStartTimeRef.current = now;

    voiceRecognition.startContinuousListening(
      (transcript, isFinal) => {
        if (isFinal) {
          const text = transcript.toLowerCase().trim();
          lastInterimRef.current = '';

          if (speakerActiveRef.current) {
            pendingTranscriptRef.current = text;
            return;
          }

          const locale = getLocale();
          const cleanText = text.toLowerCase().trim().replace(/[.,!?;:]/g, '');
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
          if (!speakerActiveRef.current && !pausedRef.current) {
            setInterimText(transcript);
            lastInterimRef.current = transcript;
          }
        }
      },
      (error) => {
        console.error('Voice error:', error);
      }
    );
  }, [processTranscript]);

  useEffect(() => {
    if (autoStart && voiceEnabled && !paused && isAvailable && !manuallyControlled) {
      if (!isListening) {
        const startDelay = voiceCaller.isSpeaking() ? 2500 : 1200;
        const timeout = setTimeout(() => {
          if (!isListening && !voiceCaller.isSpeaking()) {
            setIsListening(true);
            setLastRecognized('');
            setInterimText('');
            startRecognition();
          }
        }, startDelay);
        return () => clearTimeout(timeout);
      }
    }

    if ((!autoStart || !voiceEnabled) && isListening && !manuallyControlled) {
      voiceRecognition.stopListening();
      setIsListening(false);
      setInterimText('');
    }
  }, [autoStart, voiceEnabled, paused, isListening, isAvailable, startRecognition, dartsCount, manuallyControlled]);

  const toggleListening = useCallback(() => {
    setManuallyControlled(true);
    if (isListening) {
      voiceRecognition.stopListening();
      setIsListening(false);
      setInterimText('');
    } else {
      setIsListening(true);
      setLastRecognized('');
      setInterimText('');
      startRecognition();
    }
  }, [isListening, startRecognition]);

  useEffect(() => {
    let restartTimeout: NodeJS.Timeout;

    const unsubscribe = voiceCaller.onSpeakingChange((isSpeaking) => {
      setSpeakerActive(isSpeaking);

      if (isSpeaking) {
        if (lastInterimRef.current && !pendingTranscriptRef.current) {
          pendingTranscriptRef.current = lastInterimRef.current.toLowerCase().trim();
        }
        lastInterimRef.current = '';
        setInterimText('');

        if (isListening && !isRestartingRef.current) {
          voiceRecognition.stopListening();
          setIsListening(false);
        }
      } else {
        clearTimeout(restartTimeout);
        restartTimeout = setTimeout(() => {
          if (isRestartingRef.current) {
            return;
          }

          if (pendingTranscriptRef.current) {
            const pending = pendingTranscriptRef.current;
            pendingTranscriptRef.current = null;
            if (!pausedRef.current && dartsCountRef.current < 3) {
              processTranscript(pending);
            }
          }

          if (autoStart && voiceEnabled && !pausedRef.current && !disabled && !isRestartingRef.current) {
            isRestartingRef.current = true;
            setTimeout(() => {
              setIsListening(true);
              startRecognition();
              setTimeout(() => {
                isRestartingRef.current = false;
              }, 500);
            }, 300);
          }
        }, 900);
      }
    });

    return () => {
      clearTimeout(restartTimeout);
      unsubscribe();
    };
  }, [processTranscript, isListening, autoStart, voiceEnabled, disabled, startRecognition]);

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
