import { useState } from 'react';
import type { DartTarget } from '../../lib/dartsEngine';

interface NumberPadInputProps {
  onThrow: (target: DartTarget) => void;
  disabled?: boolean;
}

type Multiplier = 'S' | 'D' | 'T';

export function NumberPadInput({ onThrow, disabled }: NumberPadInputProps) {
  const [multiplier, setMultiplier] = useState<Multiplier>('S');

  const handleNumberClick = (num: number) => {
    if (disabled) return;

    if (num === 0) {
      onThrow('MISS');
      return;
    }

    if (num === 25 && multiplier === 'S') {
      onThrow('OB');
      setMultiplier('S');
      return;
    }

    if (num === 25 && multiplier === 'D') {
      onThrow('BULL');
      setMultiplier('S');
      return;
    }

    const target = `${multiplier}${num}` as DartTarget;
    onThrow(target);
    setMultiplier('S');
  };

  const multiplierButtons: { value: Multiplier; label: string; color: string }[] = [
    { value: 'D', label: 'Dupla', color: 'bg-secondary-600' },
    { value: 'T', label: 'Tripla', color: 'bg-error-600' },
  ];

  const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25];

  return (
    <div className="space-y-1.5 max-w-md mx-auto">
      <div className="grid grid-cols-2 gap-1.5">
        {multiplierButtons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => setMultiplier(btn.value)}
            disabled={disabled}
            className={`py-1.5 md:py-2 rounded-lg font-bold text-white transition-all text-sm ${
              multiplier === btn.value
                ? `${btn.color} ring-2 ring-white`
                : 'bg-dark-700 hover:bg-dark-600'
            } disabled:opacity-50`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-6 gap-1">
        {numbers.map((num) => {
          const isDisabled = disabled || (multiplier === 'T' && num === 25);
          return (
            <button
              key={num}
              onClick={() => handleNumberClick(num)}
              disabled={isDisabled}
              className={`aspect-square py-1.5 md:py-1 rounded-lg font-bold transition-all text-sm md:text-xs ${
                isDisabled
                  ? 'bg-dark-800 text-dark-500 cursor-not-allowed opacity-30'
                  : multiplier === 'S'
                  ? 'bg-dark-700 hover:bg-dark-600 text-white'
                  : multiplier === 'D'
                  ? 'bg-secondary-700 hover:bg-secondary-600 text-white'
                  : 'bg-error-700 hover:bg-error-600 text-white'
              }`}
            >
              {num}
            </button>
          );
        })}
      </div>
    </div>
  );
}
