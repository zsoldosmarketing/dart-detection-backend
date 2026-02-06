import { useState } from 'react';
import type { DartTarget } from '../../lib/dartsEngine';

interface NumberPadInputProps {
  onThrow?: (target: DartTarget) => void;
  onScoreSelect?: (target: DartTarget) => void;
  disabled?: boolean;
}

type Multiplier = 'S' | 'D' | 'T';

export function NumberPadInput({ onThrow, onScoreSelect, disabled }: NumberPadInputProps) {
  const [multiplier, setMultiplier] = useState<Multiplier>('S');

  const emit = onThrow || onScoreSelect;

  const handleNumberClick = (num: number) => {
    if (disabled || !emit) return;

    if (num === 0) {
      emit('MISS');
      return;
    }

    if (num === 25 && multiplier === 'S') {
      emit('OB');
      setMultiplier('S');
      return;
    }

    if (num === 25 && multiplier === 'D') {
      emit('BULL');
      setMultiplier('S');
      return;
    }

    const target = `${multiplier}${num}` as DartTarget;
    emit(target);
    setMultiplier('S');
  };

  const multiplierButtons: { value: Multiplier; label: string; activeBg: string; activeRing: string }[] = [
    { value: 'D', label: 'DUPLA', activeBg: 'bg-green-700', activeRing: 'ring-green-400' },
    { value: 'T', label: 'TRIPLA', activeBg: 'bg-red-700', activeRing: 'ring-red-400' },
  ];

  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25, 0];

  return (
    <div className="w-full mx-auto space-y-2" style={{ maxWidth: 'min(100vw - 16px, 520px)' }}>
      <div className="grid grid-cols-2 gap-2">
        {multiplierButtons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => setMultiplier(prev => prev === btn.value ? 'S' : btn.value)}
            disabled={disabled}
            className={`py-3 rounded-xl font-extrabold text-white transition-all text-base tracking-wide active:scale-[0.97] ${
              multiplier === btn.value
                ? `${btn.activeBg} ring-2 ${btn.activeRing} shadow-lg`
                : 'bg-dark-700 hover:bg-dark-600'
            } disabled:opacity-50`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {numbers.map((num) => {
          const isDisabled = disabled || (multiplier === 'T' && num === 25);
          const isMiss = num === 0;
          const isBull = num === 25;
          return (
            <button
              key={num}
              onClick={() => handleNumberClick(num)}
              disabled={isDisabled}
              className={`rounded-xl font-bold transition-all active:scale-[0.93] min-h-[3rem] sm:min-h-[3.25rem] text-base sm:text-lg ${
                isDisabled
                  ? 'bg-dark-800 text-dark-600 cursor-not-allowed opacity-30'
                  : isMiss
                  ? 'bg-dark-800 hover:bg-dark-700 text-dark-400 hover:text-white border border-dark-700'
                  : isBull
                  ? multiplier === 'D'
                    ? 'bg-red-800 hover:bg-red-700 text-white ring-1 ring-red-500/50'
                    : 'bg-green-800 hover:bg-green-700 text-white ring-1 ring-green-500/50'
                  : multiplier === 'S'
                  ? 'bg-dark-700 hover:bg-dark-600 text-white'
                  : multiplier === 'D'
                  ? 'bg-green-800/80 hover:bg-green-700 text-white'
                  : 'bg-red-800/80 hover:bg-red-700 text-white'
              }`}
            >
              {isMiss ? 'MISS' : num}
            </button>
          );
        })}
      </div>
    </div>
  );
}
