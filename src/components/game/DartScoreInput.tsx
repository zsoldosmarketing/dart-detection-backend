import { useState, useEffect } from 'react';
import {
  RotateCcw,
  Lightbulb,
  HelpCircle,
  CircleDot,
  Grid3X3,
  Settings,
  Zap,
  Target,
  Mic,
  Volume2,
  VolumeX,
  Camera,
} from 'lucide-react';
import { DartboardInput } from './DartboardInput';
import { NumberPadInput } from './NumberPadInput';
import { VoiceInput } from './VoiceInput';
import { CameraDetectionInput } from './CameraDetectionInput';
import { Card } from '../ui/Card';
import { t } from '../../lib/i18n';
import { formatDartDisplay, type DartTarget, type DartThrow } from '../../lib/dartsEngine';
import { voiceRecognition, type RecognitionMode } from '../../lib/voiceRecognition';
import { audioProcessor } from '../../lib/audioProcessor';

type InputMode = 'dartboard' | 'numberpad' | 'camera';

interface Suggestion {
  route: string;
  description?: string;
}

interface DartConfidence {
  index: number;
  confidence: number;
}

interface DartScoreInputProps {
  onThrow: (target: DartTarget) => void;
  onUndo: () => void;
  onSubmit: () => void;
  onCorrectDart?: (index: number, target: DartTarget) => void;
  currentDarts: DartThrow[];
  queuedDarts: DartTarget[];
  dartConfidences?: DartConfidence[];
  thrownScore: number;
  queuedScore: number;
  isProcessing: boolean;
  canSubmit: boolean;
  showSuggestions?: boolean;
  onToggleSuggestions?: () => void;
  suggestions?: Suggestion[];
  disabled?: boolean;
  autoStart?: boolean;
  voiceEnabled?: boolean;
  onToggleVoice?: () => void;
  soundEnabled?: boolean;
}

export function DartScoreInput({
  onThrow,
  onUndo,
  onSubmit,
  onCorrectDart,
  currentDarts,
  queuedDarts,
  dartConfidences = [],
  thrownScore,
  queuedScore,
  isProcessing,
  canSubmit,
  showSuggestions = false,
  onToggleSuggestions,
  suggestions = [],
  disabled = false,
  autoStart = true,
  voiceEnabled = false,
  onToggleVoice,
  soundEnabled = true,
}: DartScoreInputProps) {
  const [inputMode, setInputMode] = useState<InputMode>('numberpad');
  const [editingDartIndex, setEditingDartIndex] = useState<number | null>(null);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [showVoiceHelp, setShowVoiceHelp] = useState(false);
  const [recognitionMode, setRecognitionMode] = useState<RecognitionMode>('balanced');
  const [noiseGateThreshold, setNoiseGateThreshold] = useState(0.01);

  useEffect(() => {
    setRecognitionMode(voiceRecognition.getMode());
    setNoiseGateThreshold(audioProcessor.getNoiseGateThreshold());
  }, []);

  const handleModeChange = (mode: RecognitionMode) => {
    setRecognitionMode(mode);
    voiceRecognition.setMode(mode);
  };

  const handleThresholdChange = (threshold: number) => {
    setNoiseGateThreshold(threshold);
    audioProcessor.setNoiseGateThreshold(threshold);
  };

  const toggleVoice = () => {
    if (onToggleVoice) {
      onToggleVoice();
    }
  };

  const totalDarts = currentDarts.length + queuedDarts.length;
  const totalScore = thrownScore + queuedScore;

  const handleVoiceInput = (score: number, multiplier: number, sector: number | null) => {
    if (totalDarts >= 3) return;

    const target: DartTarget = sector === null
      ? { type: 'miss', sector: 0 }
      : sector === 25
      ? { type: multiplier === 2 ? 'double-bull' : 'single-bull', sector: 25 }
      : { type: multiplier === 2 ? 'double' : multiplier === 3 ? 'triple' : 'single', sector: sector };

    onThrow(target);
  };

  const getConfidenceColor = (confidence: number | undefined) => {
    if (confidence === undefined) return { bg: 'bg-primary-100 dark:bg-primary-900/30', text: 'text-primary-600 dark:text-primary-400', glow: '' };
    if (confidence >= 0.8) return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', glow: 'ring-2 ring-green-500/30' };
    if (confidence >= 0.6) return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', glow: 'ring-2 ring-amber-500/30' };
    return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', glow: 'ring-2 ring-red-500/30' };
  };

  const handleSlotClick = (idx: number) => {
    if (currentDarts[idx] && onCorrectDart) {
      setEditingDartIndex(idx);
    }
  };

  const handleCorrectionThrow = (target: DartTarget) => {
    if (editingDartIndex !== null && onCorrectDart) {
      onCorrectDart(editingDartIndex, target);
      setEditingDartIndex(null);
    }
  };

  if (editingDartIndex !== null) {
    return (
      <Card padding="none" className="p-2 sm:p-3 h-full flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-dark-300">
            Javitas: {editingDartIndex + 1}. nyil
          </span>
          <button
            onClick={() => setEditingDartIndex(null)}
            className="px-3 py-1 rounded-lg bg-dark-700 hover:bg-dark-600 text-white text-sm"
          >
            Megse
          </button>
        </div>
        <NumberPadInput
          onScoreSelect={handleCorrectionThrow}
          disabled={false}
        />
      </Card>
    );
  }

  return (
    <Card padding="none" className="p-2 sm:p-3 h-full flex flex-col overflow-hidden">
      <div className="shrink-0">
      <div className="flex items-center justify-center gap-2 mb-1">
        {[0, 1, 2].map((idx) => {
          const dart = currentDarts[idx];
          const queuedDart = !dart && queuedDarts[idx - currentDarts.length];
          const targetToShow = dart?.target || queuedDart;
          const dartConfidence = dartConfidences.find(d => d.index === idx)?.confidence;

          const displayValue = targetToShow ? formatDartDisplay(targetToShow) : '-';
          const isQueued = !dart && queuedDart;
          const colors = dart ? getConfidenceColor(dartConfidence) : null;
          const canEdit = dart && onCorrectDart;

          return (
            <button
              key={idx}
              onClick={() => handleSlotClick(idx)}
              disabled={!canEdit}
              className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-sm font-bold transition-all ${
                dart
                  ? `${colors!.bg} ${colors!.text} ${colors!.glow} ${canEdit ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}`
                  : isQueued
                  ? 'bg-secondary-100 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400 animate-pulse'
                  : 'bg-dark-100 dark:bg-dark-700 text-dark-400 cursor-default'
              }`}
            >
              <span>{displayValue}</span>
              {dartConfidence !== undefined && dart && (
                <span className="text-[10px] opacity-60">{Math.round(dartConfidence * 100)}%</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-dark-400 text-center mb-1">
        Nyil {totalDarts} / 3 | {totalScore} pont
      </p>

      <div className="flex items-center gap-1 mb-1">
        <button
          onClick={onUndo}
          disabled={(currentDarts.length === 0 && queuedDarts.length === 0) || isProcessing || disabled}
          className="p-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 text-white disabled:opacity-30 transition-all"
          title={t('common.undo')}
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={onSubmit}
          disabled={!canSubmit || isProcessing || disabled}
          className="px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-30 transition-all text-sm font-medium flex-1"
        >
          Beküldes ({totalDarts}/3)
        </button>

        {onToggleSuggestions && (
          <button
            onClick={onToggleSuggestions}
            className={`p-1.5 rounded-lg transition-all ${
              showSuggestions
                ? 'bg-primary-600 text-white'
                : 'bg-dark-700 hover:bg-dark-600 text-white'
            }`}
            title={showSuggestions ? 'Javaslatok elrejtese' : 'Javaslatok megjelenítése'}
          >
            <Lightbulb className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={() => setShowVoiceHelp(true)}
          className="p-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 text-white transition-all"
          title="Hangvezérlés súgó"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        <button
          onClick={() => setInputMode('dartboard')}
          className={`p-1.5 rounded-lg transition-all ${
            inputMode === 'dartboard'
              ? 'bg-primary-600 text-white'
              : 'bg-dark-700 hover:bg-dark-600 text-white'
          }`}
          title={t('training.dartboard')}
        >
          <CircleDot className="w-4 h-4" />
        </button>

        <button
          onClick={() => setInputMode('numberpad')}
          className={`p-1.5 rounded-lg transition-all ${
            inputMode === 'numberpad'
              ? 'bg-primary-600 text-white'
              : 'bg-dark-700 hover:bg-dark-600 text-white'
          }`}
          title={t('training.numberpad')}
        >
          <Grid3X3 className="w-4 h-4" />
        </button>

        <button
          onClick={() => setInputMode('camera')}
          className={`p-1.5 rounded-lg transition-all ${
            inputMode === 'camera'
              ? 'bg-green-600 text-white'
              : 'bg-dark-700 hover:bg-dark-600 text-white'
          }`}
          title="Kamera felismeres"
        >
          <Camera className="w-4 h-4" />
        </button>

        <button
          onClick={() => setShowVoiceSettings(!showVoiceSettings)}
          className={`p-1.5 rounded-lg transition-all ${
            showVoiceSettings
              ? 'bg-primary-600 text-white'
              : 'bg-dark-700 hover:bg-dark-600 text-white'
          }`}
          title="Beállítások"
        >
          <Settings className="w-4 h-4" />
        </button>

        <VoiceInput
          onScoreInput={handleVoiceInput}
          onUndo={onUndo}
          onSubmit={onSubmit}
          disabled={disabled}
          paused={false}
          autoStart={autoStart}
          dartsCount={totalDarts}
          voiceEnabled={voiceEnabled}
          onToggleVoice={toggleVoice}
          soundEnabled={soundEnabled}
        />
      </div>

      {showVoiceSettings && (
        <div className="mb-2 p-2 rounded-lg bg-dark-100 dark:bg-dark-800 space-y-3">
          <div>
            <p className="text-xs font-semibold text-dark-700 dark:text-dark-300 mb-2">
              Felismerési mód
            </p>
            <p className="text-[10px] text-dark-500 dark:text-dark-400 mb-2">
              Gyors = alacsonyabb pontosság, gyorsabb reagálás. Pontos = magasabb pontosság,
              lassabb reagálás.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { mode: 'fast' as RecognitionMode, label: 'Gyors', icon: Zap },
                { mode: 'balanced' as RecognitionMode, label: 'Kiegyensúlyozott', icon: CircleDot },
                { mode: 'accurate' as RecognitionMode, label: 'Pontos', icon: Target },
              ].map(({ mode, label, icon: Icon }) => (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  className={`py-2 px-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                    recognitionMode === mode
                      ? 'bg-primary-500 text-white'
                      : 'bg-dark-200 dark:bg-dark-700 text-dark-600 dark:text-dark-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-dark-700 dark:text-dark-300 mb-2 flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Zajszűrő küszöb: {noiseGateThreshold.toFixed(3)}
            </p>
            <p className="text-[10px] text-dark-500 dark:text-dark-400 mb-2">
              Alacsonyabb érték = érzékenyebb mikrofon (több háttérzaj). Magasabb érték = kevésbé
              érzékeny (kevesebb hamis pozitív).
            </p>
            <input
              type="range"
              min="0.001"
              max="0.1"
              step="0.001"
              value={noiseGateThreshold}
              onChange={(e) => handleThresholdChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-dark-300 dark:bg-dark-600 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <div className="flex justify-between mt-1 text-[10px] text-dark-500">
              <span>Érzékeny</span>
              <span>Kevésbé érzékeny</span>
            </div>
          </div>

          <div>
            <button
              onClick={toggleVoice}
              className={`w-full py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                voiceEnabled
                  ? 'bg-success-500 text-white'
                  : 'bg-dark-300 dark:bg-dark-700 text-dark-600 dark:text-dark-400'
              }`}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              {voiceEnabled ? 'Hangvezérlés bekapcsolva' : 'Hangvezérlés kikapcsolva'}
            </button>
          </div>
        </div>
      )}

      {showVoiceHelp && (
        <div className="mb-2 p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm font-semibold text-primary-700 dark:text-primary-400">
              Hangvezérlés súgó
            </p>
            <button
              onClick={() => setShowVoiceHelp(false)}
              className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2 text-xs text-primary-800 dark:text-primary-300">
            <p>
              <strong>Példák:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>"Húsz" vagy "Egyszerű húsz" → S20</li>
              <li>"Dupla húsz" → D20</li>
              <li>"Tripla húsz" → T20</li>
              <li>"Huszonöt" → Outer Bull</li>
              <li>"Bika" vagy "Bull" → Inner Bull</li>
              <li>"Mellé" vagy "Miss" → Miss</li>
              <li>"Vissza" → Visszavonás</li>
              <li>"Kész" vagy "Beküld" → Beküldés</li>
            </ul>
          </div>
        </div>
      )}

      </div>
      <div className="flex-1 min-h-0 mt-1">
        {inputMode === 'dartboard' && (
          <DartboardInput onThrow={onThrow} disabled={isProcessing || totalDarts >= 3 || disabled} />
        )}
        {inputMode === 'numberpad' && (
          <NumberPadInput onThrow={onThrow} disabled={isProcessing || totalDarts >= 3 || disabled} />
        )}
        {inputMode === 'camera' && (
          <CameraDetectionInput
            onThrow={onThrow}
            disabled={isProcessing || disabled}
            remainingDarts={3 - totalDarts}
            voiceEnabled={voiceEnabled}
          />
        )}
      </div>
    </Card>
  );
}
