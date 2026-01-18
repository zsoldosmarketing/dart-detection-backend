import { useState, useCallback } from 'react';
import { X, Check, Target, Mic, MicOff } from 'lucide-react';
import { Button } from '../ui/Button';
import type { DartTarget } from '../../lib/dartsEngine';
import type { DetectionResult } from '../../lib/visionDetection';

interface DetectionCorrectionModalProps {
  lastDetection: DetectionResult | null;
  onSubmit: (target: DartTarget) => void;
  onCancel: () => void;
}

const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const MULTIPLIERS = ['S', 'D', 'T'] as const;

type MultiplierType = typeof MULTIPLIERS[number];

export function DetectionCorrectionModal({
  lastDetection,
  onSubmit,
  onCancel,
}: DetectionCorrectionModalProps) {
  const [selectedSector, setSelectedSector] = useState<number | null>(() => {
    if (lastDetection?.target) {
      const match = lastDetection.target.match(/[SDT](\d+)/);
      if (match) return parseInt(match[1]);
      if (lastDetection.target === 'BULL' || lastDetection.target === 'OB') return 25;
    }
    return null;
  });

  const [selectedMultiplier, setSelectedMultiplier] = useState<MultiplierType | 'BULL' | 'OB'>(() => {
    if (lastDetection?.target) {
      if (lastDetection.target === 'BULL') return 'BULL';
      if (lastDetection.target === 'OB') return 'OB';
      if (lastDetection.target.startsWith('D')) return 'D';
      if (lastDetection.target.startsWith('T')) return 'T';
    }
    return 'S';
  });

  const [isListening, setIsListening] = useState(false);

  const getTarget = useCallback((): DartTarget | null => {
    if (selectedSector === 25) {
      return selectedMultiplier === 'BULL' ? 'BULL' : 'OB';
    }
    if (selectedSector === 0) {
      return 'MISS';
    }
    if (selectedSector && selectedMultiplier !== 'BULL' && selectedMultiplier !== 'OB') {
      return `${selectedMultiplier}${selectedSector}` as DartTarget;
    }
    return null;
  }, [selectedSector, selectedMultiplier]);

  const getScoreDisplay = useCallback((): string => {
    const target = getTarget();
    if (!target) return '-';
    if (target === 'MISS') return '0';
    if (target === 'BULL') return '50';
    if (target === 'OB') return '25';

    const sector = parseInt(target.slice(1));
    if (target.startsWith('D')) return String(sector * 2);
    if (target.startsWith('T')) return String(sector * 3);
    return String(sector);
  }, [getTarget]);

  const handleSubmit = useCallback(() => {
    const target = getTarget();
    if (target) {
      onSubmit(target);
    }
  }, [getTarget, onSubmit]);

  const handleVoiceResult = useCallback((transcript: string) => {
    const lower = transcript.toLowerCase().trim();

    const missPatterns = ['miss', 'melle', 'nulla', 'zero', '0'];
    if (missPatterns.some(p => lower.includes(p))) {
      setSelectedSector(0);
      return;
    }

    const bullPatterns = ['bull', 'kozep', '50', 'fifty'];
    if (bullPatterns.some(p => lower.includes(p))) {
      setSelectedSector(25);
      setSelectedMultiplier('BULL');
      return;
    }

    const outerBullPatterns = ['kisbull', 'outer', '25', 'huszonot'];
    if (outerBullPatterns.some(p => lower.includes(p))) {
      setSelectedSector(25);
      setSelectedMultiplier('OB');
      return;
    }

    let mult: MultiplierType = 'S';
    if (lower.includes('dupla') || lower.includes('double') || lower.match(/\bd\s*\d/)) {
      mult = 'D';
    } else if (lower.includes('tripla') || lower.includes('triple') || lower.match(/\bt\s*\d/)) {
      mult = 'T';
    }

    const numMatch = lower.match(/\d+/);
    if (numMatch) {
      const num = parseInt(numMatch[0]);
      if (num >= 1 && num <= 20) {
        setSelectedSector(num);
        setSelectedMultiplier(mult);
      }
    }
  }, []);

  const toggleVoice = useCallback(() => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      return;
    }

    setIsListening(true);

    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'hu-HU';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      handleVoiceResult(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }, [isListening, handleVoiceResult]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-gray-900 w-full max-w-lg rounded-t-xl sm:rounded-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-semibold text-white">Dobas Javitasa</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {lastDetection && (
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <p className="text-gray-400 text-sm">Eredeti felismeres:</p>
              <p className="text-white font-medium">
                {lastDetection.target} ({(lastDetection.confidence * 100).toFixed(0)}%)
              </p>
            </div>
          )}

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-center">
            <p className="text-blue-300 text-sm mb-1">Kivalasztott dobas</p>
            <p className="text-3xl font-bold text-white">{getTarget() || '-'}</p>
            <p className="text-blue-300">= {getScoreDisplay()} pont</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Szorzó</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleVoice}
                className={isListening ? 'text-red-400' : ''}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <button
                onClick={() => {
                  setSelectedMultiplier('S');
                  if (selectedSector === 25) setSelectedSector(null);
                }}
                className={`py-2 rounded-lg font-medium transition-colors ${
                  selectedMultiplier === 'S'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Single
              </button>
              <button
                onClick={() => {
                  setSelectedMultiplier('D');
                  if (selectedSector === 25) setSelectedSector(null);
                }}
                className={`py-2 rounded-lg font-medium transition-colors ${
                  selectedMultiplier === 'D'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Double
              </button>
              <button
                onClick={() => {
                  setSelectedMultiplier('T');
                  if (selectedSector === 25) setSelectedSector(null);
                }}
                className={`py-2 rounded-lg font-medium transition-colors ${
                  selectedMultiplier === 'T'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Triple
              </button>
              <button
                onClick={() => {
                  setSelectedSector(25);
                  setSelectedMultiplier('OB');
                }}
                className={`py-2 rounded-lg font-medium transition-colors ${
                  selectedMultiplier === 'OB'
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                OB
              </button>
              <button
                onClick={() => {
                  setSelectedSector(25);
                  setSelectedMultiplier('BULL');
                }}
                className={`py-2 rounded-lg font-medium transition-colors ${
                  selectedMultiplier === 'BULL'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                BULL
              </button>
            </div>
          </div>

          <div>
            <span className="text-gray-400 text-sm mb-2 block">Szektor</span>
            <div className="grid grid-cols-5 gap-2">
              {SECTORS.map(sector => (
                <button
                  key={sector}
                  onClick={() => setSelectedSector(sector)}
                  disabled={selectedMultiplier === 'BULL' || selectedMultiplier === 'OB'}
                  className={`py-3 rounded-lg font-medium transition-colors ${
                    selectedSector === sector
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50'
                  }`}
                >
                  {sector}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setSelectedSector(0)}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${
              selectedSector === 0
                ? 'bg-gray-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            MISS (0)
          </button>
        </div>

        <div className="sticky bottom-0 bg-gray-900 border-t border-gray-800 p-4 flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Megse
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!getTarget()}
            className="flex-1"
          >
            <Check className="w-4 h-4 mr-2" />
            Megerosit
          </Button>
        </div>
      </div>
    </div>
  );
}
