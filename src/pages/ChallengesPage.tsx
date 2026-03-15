import { useState, useEffect } from 'react';
import {
  Flame,
  Target,
  Trophy,
  Clock,
  CheckCircle,
  Calendar,
  Gift,
  ChevronRight,
  Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { format, differenceInDays, differenceInHours } from 'date-fns';
import { hu } from 'date-fns/locale';
import clsx from 'clsx';
import { t } from '../lib/i18n';

interface Challenge {
  id: string;
  name_key: string;
  desc_key: string;
  rule: {
    type: string;
    target: number;
    metric?: string;
    days?: number;
  };
  reward: {
    type: string;
    amount: number;
  };
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
}

interface ChallengeWithProgress extends Challenge {
  progress: number;
  isCompleted: boolean;
  timeRemaining: string | null;
}

export function ChallengesPage() {
  const { user, profile } = useAuthStore();
  const [challenges, setChallenges] = useState<ChallengeWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    fetchChallenges();
  }, [user, profile]);

  const fetchChallenges = async () => {
    setIsLoading(true);

    const { data } = await supabase
      .from('challenges')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (data) {
      const withProgress = data.map(challenge => {
        const progress = calculateProgress(challenge);
        const isCompleted = progress >= 100;
        const timeRemaining = challenge.end_date
          ? getTimeRemaining(challenge.end_date)
          : null;

        return {
          ...challenge,
          progress,
          isCompleted,
          timeRemaining,
        };
      });

      setChallenges(withProgress);
    }

    setIsLoading(false);
  };

  const calculateProgress = (challenge: Challenge): number => {
    if (!profile) return 0;

    const rule = challenge.rule;

    switch (rule.type) {
      case 'streak':
        return Math.min((profile.current_streak / rule.target) * 100, 100);
      case 'games':
        return Math.min((profile.total_games_played / rule.target) * 100, 100);
      case 'wins':
        return Math.min((profile.total_wins / rule.target) * 100, 100);
      case 'checkouts':
        return Math.min((profile.total_checkouts / rule.target) * 100, 100);
      case 'highest_checkout':
        return Math.min((profile.highest_checkout / rule.target) * 100, 100);
      default:
        return 0;
    }
  };

  const getTimeRemaining = (endDate: string): string | null => {
    const end = new Date(endDate);
    const now = new Date();

    if (end < now) return null;

    const days = differenceInDays(end, now);
    if (days > 0) return `${days} nap`;

    const hours = differenceInHours(end, now);
    return `${hours} ora`;
  };

  const getChallengeIcon = (type: string) => {
    switch (type) {
      case 'streak': return <Flame className="w-5 h-5" />;
      case 'games': return <Target className="w-5 h-5" />;
      case 'wins': return <Trophy className="w-5 h-5" />;
      case 'checkouts': return <Zap className="w-5 h-5" />;
      default: return <Target className="w-5 h-5" />;
    }
  };

  const getRewardIcon = (type: string) => {
    switch (type) {
      case 'tokens': return <Gift className="w-4 h-4" />;
      case 'badge': return <Trophy className="w-4 h-4" />;
      default: return <Gift className="w-4 h-4" />;
    }
  };

  const filteredChallenges = challenges.filter(c => {
    if (filter === 'active') return !c.isCompleted;
    if (filter === 'completed') return c.isCompleted;
    return true;
  });

  const activeChallenges = challenges.filter(c => !c.isCompleted).length;
  const completedChallenges = challenges.filter(c => c.isCompleted).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-secondary-500/10 dark:bg-secondary-500/20 flex items-center justify-center">
          <Flame className="w-5 h-5 text-secondary-600 dark:text-secondary-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Kihívások</h1>
          <p className="text-dark-500 dark:text-dark-400">Teljesíts kihívásokat és szerezz jutalmakat</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-dark-900 dark:text-white">{challenges.length}</p>
          <p className="text-sm text-dark-500">Összes</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-warning-500">{activeChallenges}</p>
          <p className="text-sm text-dark-500">Aktív</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-success-500">{completedChallenges}</p>
          <p className="text-sm text-dark-500">Teljesített</p>
        </Card>
      </div>

      <div className="flex gap-2">
        {(['all', 'active', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              filter === f
                ? 'bg-primary-500 text-white'
                : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-300 hover:bg-dark-200 dark:hover:bg-dark-600'
            )}
          >
            {f === 'all' ? 'Mind' : f === 'active' ? 'Aktív' : 'Teljesített'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredChallenges.length === 0 ? (
          <Card className="p-8 text-center">
            <Flame className="w-12 h-12 text-dark-400 mx-auto mb-4" />
            <p className="text-dark-500">
              {filter === 'completed'
                ? 'Még nincs teljesített kihívásod.'
                : 'Nincs elérhető kihívás.'}
            </p>
          </Card>
        ) : (
          filteredChallenges.map((challenge) => (
            <Card key={challenge.id} className="p-4">
              <div className="flex items-start gap-4">
                <div className={clsx(
                  'w-12 h-12 rounded-xl flex items-center justify-center',
                  challenge.isCompleted
                    ? 'bg-success-500/10 text-success-500'
                    : 'bg-secondary-500/10 text-secondary-500'
                )}>
                  {challenge.isCompleted ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : (
                    getChallengeIcon(challenge.rule.type)
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-dark-900 dark:text-white">
                        {t(challenge.name_key)}
                      </h3>
                      <p className="text-sm text-dark-500 mt-1">
                        {t(challenge.desc_key)}
                      </p>
                    </div>
                    {challenge.timeRemaining && (
                      <Badge variant="warning" className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {challenge.timeRemaining}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-dark-500">
                        Haladas: {Math.round(challenge.progress)}%
                      </span>
                      <div className="flex items-center gap-1 text-sm">
                        {getRewardIcon(challenge.reward.type)}
                        <span className="font-medium text-dark-900 dark:text-white">
                          {challenge.reward.amount} {challenge.reward.type === 'tokens' ? 'token' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-dark-100 dark:bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all duration-500',
                          challenge.isCompleted
                            ? 'bg-success-500'
                            : 'bg-gradient-to-r from-secondary-500 to-primary-500'
                        )}
                        style={{ width: `${challenge.progress}%` }}
                      />
                    </div>
                  </div>

                  {challenge.isCompleted && (
                    <div className="mt-3 flex items-center gap-2 text-success-600 dark:text-success-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Teljesitve!</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
