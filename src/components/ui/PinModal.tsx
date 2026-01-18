import { useState, useRef, useEffect } from 'react';
import { X, Lock } from 'lucide-react';
import { Button } from './Button';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (pin: string) => Promise<boolean>;
  playerName: string;
}

export function PinModal({ isOpen, onClose, onVerify, playerName }: PinModalProps) {
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setPin(['', '', '', '', '', '']);
      setError('');
      inputRefs.current[0]?.focus();
    }
  }, [isOpen]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value[value.length - 1];
    }

    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError('');

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newPin.every((digit) => digit !== '')) {
      handleVerify(newPin.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();

    if (/^\d{6}$/.test(pastedData)) {
      const newPin = pastedData.split('');
      setPin(newPin);
      setError('');
      inputRefs.current[5]?.focus();
      handleVerify(pastedData);
    }
  };

  const handleVerify = async (pinValue: string) => {
    setIsVerifying(true);
    setError('');

    try {
      const isValid = await onVerify(pinValue);

      if (isValid) {
        onClose();
      } else {
        setError('Hibás PIN kód');
        setPin(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      setError('Hiba történt a validálás során');
      console.error('PIN verification error:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <Lock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-xl font-bold text-dark-900 dark:text-white">
              PIN kód ellenőrzés
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-dark-600 dark:text-dark-400 mb-6">
          Add meg <span className="font-semibold text-dark-900 dark:text-white">{playerName}</span> PIN kódját a játékhoz való csatlakozáshoz.
        </p>

        <div className="flex gap-2 justify-center mb-6">
          {pin.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={isVerifying}
              className={`w-12 h-14 text-center text-2xl font-bold rounded-lg border-2 transition-all ${
                error
                  ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                  : digit
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-dark-300 dark:border-dark-600 bg-white dark:bg-dark-700'
              } text-dark-900 dark:text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-800 disabled:opacity-50`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg">
            <p className="text-sm text-error-600 dark:text-error-400 text-center">
              {error}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isVerifying}
            className="flex-1"
          >
            Mégse
          </Button>
          <Button
            variant="primary"
            onClick={() => handleVerify(pin.join(''))}
            disabled={pin.some((digit) => digit === '') || isVerifying}
            isLoading={isVerifying}
            className="flex-1"
          >
            Ellenőrzés
          </Button>
        </div>

        <p className="text-xs text-dark-500 dark:text-dark-400 text-center mt-4">
          A PIN kód a játékos biztonsági kódja, amelyet csak ő ismer.
        </p>
      </div>
    </div>
  );
}
