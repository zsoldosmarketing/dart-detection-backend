import { memo } from 'react';
import {
  Trophy,
  Target,
  TrendingUp,
  Award,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { t } from '../../lib/i18n';

interface StatsSectionProps {
  profile: {
    total_games_played?: number;
    total_wins?: number;
    average_score?: number;
    highest_checkout?: number;
    current_streak?: number;
    longest_streak?: number;
  } | null;
}

export const StatsSection = memo(function StatsSection({ profile }: StatsSectionProps) {
  const stats = [
    { label: t('stats.games_played'), value: profile?.total_games_played || 0, icon: Target },
    { label: t('stats.wins'), value: profile?.total_wins || 0, icon: Trophy },
    { label: t('stats.average'), value: profile?.average_score?.toFixed(1) || '0.0', icon: TrendingUp },
    { label: t('stats.highest_checkout'), value: profile?.highest_checkout || 0, icon: Award },
    { label: t('stats.current_streak'), value: `${profile?.current_streak || 0} nap`, icon: Target },
    { label: t('stats.longest_streak'), value: `${profile?.longest_streak || 0} nap`, icon: Trophy },
  ];

  const achievements = [
    { name: 'First Game', icon: '🎯', unlocked: (profile?.total_games_played || 0) > 0 },
    { name: 'First Win', icon: '🏆', unlocked: (profile?.total_wins || 0) > 0 },
    { name: '3 Day Streak', icon: '🔥', unlocked: (profile?.longest_streak || 0) >= 3 },
    { name: '100+ Checkout', icon: '💯', unlocked: (profile?.highest_checkout || 0) >= 100 },
    { name: '7 Day Streak', icon: '⭐', unlocked: (profile?.longest_streak || 0) >= 7 },
    { name: '170 Checkout', icon: '👑', unlocked: (profile?.highest_checkout || 0) >= 170 },
  ];

  return (
    <>
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>{t('profile.stats')}</CardTitle>
          <Link to="/statistics">
            <Button variant="ghost" size="sm" rightIcon={<ChevronRight className="w-4 h-4" />}>
              Részletes
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="p-4 rounded-lg bg-dark-50 dark:bg-dark-700/50"
              >
                <div className="flex items-center gap-2 text-dark-500 dark:text-dark-400 mb-2">
                  <Icon className="w-4 h-4" />
                  <span className="text-xs">{stat.label}</span>
                </div>
                <p className="text-xl font-bold text-dark-900 dark:text-white">
                  {stat.value}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle>{t('profile.achievements')}</CardTitle>
        <div className="mt-4 grid grid-cols-4 sm:grid-cols-6 gap-4">
          {achievements.map((achievement) => (
            <div
              key={achievement.name}
              className={`flex flex-col items-center p-3 rounded-lg ${
                achievement.unlocked
                  ? 'bg-primary-50 dark:bg-primary-900/20'
                  : 'bg-dark-100 dark:bg-dark-800 opacity-50'
              }`}
              title={achievement.name}
            >
              <span className="text-2xl">{achievement.icon}</span>
              <span className="text-[10px] text-dark-500 mt-1 text-center truncate w-full">
                {achievement.name}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
});
