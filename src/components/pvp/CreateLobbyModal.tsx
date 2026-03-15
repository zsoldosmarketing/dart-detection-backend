import { memo } from 'react';
import { t } from '../../lib/i18n';
import {
  Plus,
  Users,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { Card, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';

type SkillFilter = 'any' | 'similar' | 'higher' | 'lower';

interface CreateLobbyModalProps {
  startingScore: number;
  legs: number;
  sets: number;
  doubleOut: boolean;
  doubleIn: boolean;
  skillFilter: SkillFilter;
  isCreating: boolean;
  onStartingScoreChange: (score: number) => void;
  onLegsChange: (legs: number) => void;
  onSetsChange: (sets: number) => void;
  onDoubleOutChange: (value: boolean) => void;
  onDoubleInChange: (value: boolean) => void;
  onSkillFilterChange: (filter: SkillFilter) => void;
  onCreateLobby: () => void;
  onClose: () => void;
}

export const CreateLobbyModal = memo(function CreateLobbyModal({
  startingScore,
  legs,
  sets,
  doubleOut,
  doubleIn,
  skillFilter,
  isCreating,
  onStartingScoreChange,
  onLegsChange,
  onSetsChange,
  onDoubleOutChange,
  onDoubleInChange,
  onSkillFilterChange,
  onCreateLobby,
  onClose,
}: CreateLobbyModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <Card className="max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-dark-800 py-2 -mt-2 z-10">
          <CardTitle>{t('lobby.title')}</CardTitle>
          <button
            onClick={onClose}
            className="p-1 text-dark-400 hover:text-dark-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 pb-2">
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              {t('lobby.starting_score')}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[301, 501, 701, 1001].map((score) => (
                <button
                  key={score}
                  onClick={() => onStartingScoreChange(score)}
                  className={`py-2 rounded-lg font-bold transition-all ${
                    startingScore === score
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200'
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                {t('lobby.legs')}
              </label>
              <input
                type="number"
                min="1"
                max="11"
                value={legs}
                onChange={(e) => onLegsChange(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-dark-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                {t('lobby.sets')}
              </label>
              <input
                type="number"
                min="1"
                max="7"
                value={sets}
                onChange={(e) => onSetsChange(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-dark-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-dark-700 dark:text-dark-300">
                Double Out
              </span>
              <button
                onClick={() => onDoubleOutChange(!doubleOut)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  doubleOut ? 'bg-primary-600' : 'bg-dark-300 dark:bg-dark-600'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    doubleOut ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-dark-700 dark:text-dark-300">
                Double In
              </span>
              <button
                onClick={() => onDoubleInChange(!doubleIn)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  doubleIn ? 'bg-primary-600' : 'bg-dark-300 dark:bg-dark-600'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    doubleIn ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              {t('lobby.opponent_level')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'any', label: t('lobby.any'), icon: <Users className="w-3.5 h-3.5" /> },
                { value: 'similar', label: t('lobby.similar'), icon: <Minus className="w-3.5 h-3.5" /> },
                { value: 'higher', label: t('lobby.higher'), icon: <TrendingUp className="w-3.5 h-3.5" /> },
                { value: 'lower', label: t('lobby.lower'), icon: <TrendingDown className="w-3.5 h-3.5" /> },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  onClick={() => onSkillFilterChange(option.value)}
                  className={`py-2.5 px-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                    skillFilter === option.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200'
                  }`}
                >
                  {option.icon}
                  <span className="truncate">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              {t('lobby.cancel')}
            </Button>
            <Button
              variant="primary"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={onCreateLobby}
              isLoading={isCreating}
              className="flex-1"
            >
              {t('lobby.enter')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
});
