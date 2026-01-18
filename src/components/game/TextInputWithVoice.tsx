import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { voiceRecognition } from '../../lib/voiceRecognition';
import { t } from '../../lib/i18n';

interface TextInputWithVoiceProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TextInputWithVoice({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
}: TextInputWithVoiceProps) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isAvailable = voiceRecognition.isAvailable();

  useEffect(() => {
    return () => {
      if (isListening) {
        voiceRecognition.stopListening();
      }
    };
  }, [isListening]);

  const toggleListening = () => {
    if (isListening) {
      voiceRecognition.stopListening();
      setIsListening(false);
      setInterimTranscript('');
    } else {
      setIsListening(true);
      voiceRecognition.startContinuousListening(
        (transcript, isFinal) => {
          if (isFinal) {
            const undoPattern = /vissza|törlés|torles|töröl|torol|undo|back|delete|remove/i;

            if (undoPattern.test(transcript.toLowerCase())) {
              const currentValue = value.trim();
              const items = currentValue.split(',').map(item => item.trim()).filter(item => item);
              if (items.length > 0) {
                items.pop();
                onChange(items.join(', '));
              }
              setInterimTranscript('');
              return;
            }

            const currentValue = value.trim();
            const separator = currentValue && !currentValue.endsWith(',') ? ', ' : '';
            const newValue = currentValue ? `${currentValue}${separator}${transcript}` : transcript;
            onChange(newValue);
            setInterimTranscript('');
          } else {
            setInterimTranscript(transcript);
          }
        },
        (error) => {
          console.error('Voice recognition error:', error);
          setIsListening(false);
          setInterimTranscript('');
        }
      );
    }
  };

  const handleClear = () => {
    onChange('');
    setInterimTranscript('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !disabled) {
      e.preventDefault();
      onSubmit();
    }
  };

  const displayValue = interimTranscript
    ? value
      ? `${value}${value.endsWith(',') ? ' ' : ', '}${interimTranscript}`
      : interimTranscript
    : value;

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'pl. T20, D16, S5, 50...'}
          className={`w-full px-4 py-2.5 pr-10 rounded-lg border ${
            interimTranscript
              ? 'border-primary-400 dark:border-primary-500'
              : 'border-dark-300 dark:border-dark-600'
          } bg-white dark:bg-dark-800 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors`}
          disabled={disabled}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition-colors"
            disabled={disabled}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {isAvailable && (
        <Button
          type="button"
          onClick={toggleListening}
          disabled={disabled}
          className={`${
            isListening
              ? 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700'
              : 'bg-primary-600 hover:bg-primary-700'
          }`}
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>
      )}

      <Button type="button" onClick={onSubmit} disabled={disabled || !value.trim()}>
        {t('game.submit')}
      </Button>
    </div>
  );
}
