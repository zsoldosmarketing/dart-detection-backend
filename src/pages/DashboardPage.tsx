import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Target,
  Gamepad2,
  Trophy,
  Users,
  TrendingUp,
  Flame,
  Award,
  ChevronRight,
  Calendar,
  Clock,
  Play,
  Pause,
} from 'lucide-react';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PushNotificationPrompt } from '../components/ui/PushNotificationPrompt';
import { t } from '../lib/i18n';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';

interface Challenge {
  id: string;
  name_key: string;
  desc_key: string;
  rule: { type: string; target: number };
  reward: { type: string; amount: number };
}

interface ActiveProgram {
  id: string;
  program_id: string;
  current_day: number;
  progress_pct: number;
  programs: {
    name_key: string;
    duration_days: number;
  };
}

interface ActiveTraining {
  id: string;
  drill_id: string;
  started_at: string;
  drills: {
    name_key: string;
    category: string;
  };
}

interface RecentActivity {
  id: string;
  type: 'game' | 'training';
  title: string;
  subtitle: string;
  date: string;
}

interface PlayerStats {
  lifetime_average: number;
  lifetime_best_average: number;
  lifetime_checkout_percentage: number;
  lifetime_highest_checkout: number;
  lifetime_180s: number;
  current_win_streak: number;
  lifetime_win_percentage: number;
}

interface PausedGame {
  game_id: string;
  game_mode: string;
  opponent_id: string;
  opponent_name: string;
  opponent_avatar: string | null;
  paused_at: string;
  paused_by: string;
  paused_by_me: boolean;
  game_state: any;
}

export function DashboardPage() {
  const { user, profile, shouldShowPushPrompt, setShouldShowPushPrompt } = useAuthStore();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [activePrograms, setActivePrograms] = useState<ActiveProgram[]>([]);
  const [activeTrainings, setActiveTrainings] = useState<ActiveTraining[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [pausedGames, setPausedGames] = useState<PausedGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    setIsLoading(true);

    const [challengesRes, programsRes, activeTrainingsRes, gamesRes, trainingsRes, statsRes] = await Promise.all([
      supabase
        .from('challenges')
        .select('id, name_key, desc_key, rule, reward')
        .eq('is_active', true)
        .limit(3),
      supabase
        .from('program_enrollments')
        .select('id, program_id, current_day, progress_pct, programs(name_key, duration_days)')
        .eq('user_id', user.id)
        .is('completed_at', null)
        .order('started_at', { ascending: false })
        .limit(3),
      supabase
        .from('training_sessions')
        .select('id, drill_id, started_at, drills(name_key, category)')
        .eq('user_id', user.id)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(3),
      supabase
        .from('game_rooms')
        .select('id, starting_score, mode, status, created_at, winner_id')
        .eq('created_by', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('training_sessions')
        .select('id, score, status, created_at, drills(name_key)')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('player_statistics_summary')
        .select('lifetime_average, lifetime_best_average, lifetime_checkout_percentage, lifetime_highest_checkout, lifetime_180s, current_win_streak, lifetime_win_percentage')
        .eq('player_id', user.id)
        .maybeSingle(),
    ]);

    if (challengesRes.data) {
      setChallenges(challengesRes.data);
    }

    if (programsRes.data) {
      setActivePrograms(programsRes.data as ActiveProgram[]);
    }

    if (activeTrainingsRes.data) {
      setActiveTrainings(activeTrainingsRes.data as ActiveTraining[]);
    }

    const activities: RecentActivity[] = [];

    if (gamesRes.data) {
      gamesRes.data.forEach((game: any) => {
        activities.push({
          id: game.id,
          type: 'game',
          title: `${game.starting_score} jatek`,
          subtitle: game.winner_id === user.id ? 'Gyozelem' : 'Vereseg',
          date: game.created_at,
        });
      });
    }

    if (trainingsRes.data) {
      trainingsRes.data.forEach((session: any) => {
        activities.push({
          id: session.id,
          type: 'training',
          title: session.drills?.name_key ? t(session.drills.name_key) : 'Edzes',
          subtitle: `${session.score || 0} pont`,
          date: session.created_at,
        });
      });
    }

    if (statsRes.data) {
      setPlayerStats(statsRes.data);
    }

    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setRecentActivity(activities.slice(0, 5));

    const { data: pausedGamesData } = await supabase.rpc('get_paused_games', {
      p_user_id: user.id,
    });

    if (pausedGamesData) {
      setPausedGames(pausedGamesData);
    }

    setIsLoading(false);
  };

  const handleResumeGame = async (gameId: string) => {
    try {
      const { data, error } = await supabase.rpc('resume_game', {
        p_game_id: gameId,
      });

      if (error) throw error;

      if (data?.success) {
        window.location.href = `/game/${gameId}`;
      } else {
        alert(data?.error || 'Hiba történt a játék folytatása közben');
      }
    } catch (err) {
      console.error('Failed to resume game:', err);
      alert('Nem sikerült folytatni a játékot');
    }
  };

  const calculateChallengeProgress = (challenge: Challenge): number => {
    if (!profile) return 0;
    const rule = challenge.rule;
    switch (rule.type) {
      case 'streak':
        return Math.min(((profile.current_streak || 0) / rule.target) * 100, 100);
      case 'games':
        return Math.min(((profile.total_games_played || 0) / rule.target) * 100, 100);
      case 'wins':
        return Math.min(((profile.total_wins || 0) / rule.target) * 100, 100);
      case 'checkouts':
        return Math.min(((profile.total_checkouts || 0) / rule.target) * 100, 100);
      case 'highest_checkout':
        return Math.min(((profile.highest_checkout || 0) / rule.target) * 100, 100);
      default:
        return 0;
    }
  };

  if (!user) {
    return <LandingPage />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">
            Udvozlunk, {profile?.display_name || profile?.username || 'Jatekos'}!
          </h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            Folytasd az edzest es javitsd az atlagodat
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/training">
            <Button leftIcon={<Target className="w-4 h-4" />}>{t('training.start')}</Button>
          </Link>
          <Link to="/game">
            <Button variant="outline" leftIcon={<Gamepad2 className="w-4 h-4" />}>
              {t('game.start')}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Flame className="w-5 h-5" />}
          label={t('stats.current_streak')}
          value={`${playerStats?.current_win_streak || profile?.current_streak || 0} nap`}
          trend={playerStats?.current_win_streak || profile?.current_streak ? '+' : undefined}
          color="accent"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label={t('stats.average')}
          value={playerStats?.lifetime_average?.toFixed(1) || profile?.average_score?.toFixed(1) || '0.0'}
          color="primary"
        />
        <StatCard
          icon={<Award className="w-5 h-5" />}
          label={t('stats.highest_checkout')}
          value={(playerStats?.lifetime_highest_checkout || profile?.highest_checkout || 0).toString()}
          color="secondary"
        />
        <StatCard
          icon={<Trophy className="w-5 h-5" />}
          label={t('stats.win_rate')}
          value={
            playerStats?.lifetime_win_percentage
              ? `${playerStats.lifetime_win_percentage.toFixed(0)}%`
              : profile?.total_games_played
              ? `${((profile.total_wins / profile.total_games_played) * 100).toFixed(0)}%`
              : '0%'
          }
          color="success"
        />
      </div>

      {pausedGames.length > 0 && (
        <Card className="border-2 border-warning-500/30 bg-warning-50/50 dark:bg-warning-900/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Pause className="w-5 h-5 text-warning-600" />
              <CardTitle>Félbehagyott játékok</CardTitle>
            </div>
            <Badge variant="warning">{pausedGames.length}</Badge>
          </div>
          <div className="space-y-3">
            {pausedGames.map((game) => (
              <div
                key={game.game_id}
                className="p-3 rounded-lg border border-warning-200 dark:border-warning-800 bg-white dark:bg-dark-800 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-warning-500 to-error-500 flex items-center justify-center text-white font-bold shrink-0">
                      {game.opponent_name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-dark-900 dark:text-white truncate">
                        {game.opponent_name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-dark-500 dark:text-dark-400">
                        <Clock className="w-3 h-3" />
                        <span>
                          {game.paused_by_me ? 'Te szüneteltetted' : 'Ellenfél szüneteltette'}
                        </span>
                        <span>•</span>
                        <span>{format(new Date(game.paused_at), 'PPp', { locale: hu })}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    leftIcon={<Play className="w-4 h-4" />}
                    onClick={() => handleResumeGame(game.game_id)}
                  >
                    Folytatás
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Aktiv edzesek</CardTitle>
            <Link to="/training">
              <Button variant="ghost" size="sm" rightIcon={<ChevronRight className="w-4 h-4" />}>
                Gyakorlatok
              </Button>
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : activeTrainings.length === 0 ? (
              <div>
                <p className="text-dark-500 dark:text-dark-400 text-sm mb-3">
                  Nincs aktiv edzes. Kezdj egy gyakorlatot!
                </p>
                {activePrograms.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-dark-600 dark:text-dark-400 uppercase">
                      Aktiv programok
                    </p>
                    {activePrograms.map((enrollment) => (
                      <Link
                        key={enrollment.id}
                        to={`/programs/${enrollment.id}`}
                        className="block p-2 rounded-lg border border-dark-200 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-dark-900 dark:text-white truncate">
                              {t(enrollment.programs.name_key)}
                            </p>
                            <p className="text-xs text-dark-500">
                              {enrollment.current_day} / {enrollment.programs.duration_days} nap • {Math.round(enrollment.progress_pct)}%
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-dark-400 flex-shrink-0" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              activeTrainings.map((training) => (
                <Link
                  key={training.id}
                  to={`/training/${training.id}`}
                  className="block p-3 rounded-lg border border-dark-200 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-dark-900 dark:text-white">
                        {t(training.drills.name_key)}
                      </p>
                      <p className="text-sm text-dark-500 dark:text-dark-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {format(new Date(training.started_at), 'HH:mm', { locale: hu })} - {t(`category.${training.drills.category}`)}
                      </p>
                    </div>
                    <Badge variant="primary" size="sm">
                      Folyamatban
                    </Badge>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Aktiv programok</CardTitle>
            <Link to="/programs">
              <Button variant="ghost" size="sm" rightIcon={<ChevronRight className="w-4 h-4" />}>
                Osszes
              </Button>
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : activePrograms.length === 0 ? (
              <p className="text-dark-500 dark:text-dark-400 text-sm">
                Nincs aktiv program. Kezdj egy uj programot!
              </p>
            ) : (
              activePrograms.map((enrollment) => (
                <Link
                  key={enrollment.id}
                  to={`/programs/${enrollment.id}`}
                  className="block p-3 rounded-lg border border-dark-200 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-dark-900 dark:text-white">
                        {t(enrollment.programs.name_key)}
                      </p>
                      <p className="text-sm text-dark-500 dark:text-dark-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {enrollment.current_day} / {enrollment.programs.duration_days} nap
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-dark-400" />
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-dark-500">{Math.round(enrollment.progress_pct)}%</span>
                    </div>
                    <div className="h-2 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full transition-all duration-500"
                        style={{ width: `${enrollment.progress_pct}%` }}
                      />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Legutobbi aktivitas</CardTitle>
          <Link to="/profile/history">
            <Button variant="ghost" size="sm" rightIcon={<ChevronRight className="w-4 h-4" />}>
              Elozmeny
            </Button>
          </Link>
        </div>
        <div className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : recentActivity.length === 0 ? (
            <p className="text-dark-500 dark:text-dark-400 text-sm">
              Nincs meg aktivitas. Kezdj edzeni vagy jatszani!
            </p>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-dark-50 dark:bg-dark-700/50"
                >
                  <div className={`p-2 rounded-lg ${
                    activity.type === 'game'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                      : 'bg-secondary-100 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400'
                  }`}>
                    {activity.type === 'game' ? (
                      <Gamepad2 className="w-4 h-4" />
                    ) : (
                      <Target className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-dark-900 dark:text-white text-sm truncate">
                      {activity.title}
                    </p>
                    <p className="text-xs text-dark-500">{activity.subtitle}</p>
                  </div>
                  <div className="text-xs text-dark-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(activity.date), 'MMM d', { locale: hu })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {shouldShowPushPrompt && (
        <PushNotificationPrompt onDismiss={() => setShouldShowPushPrompt(false)} />
      )}
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center text-center animate-fade-in">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 mb-6">
        <Target className="w-10 h-10 text-white" />
      </div>
      <h1 className="text-3xl sm:text-4xl font-bold text-dark-900 dark:text-white mb-4">
        DartsTraining
      </h1>
      <p className="text-lg text-dark-500 dark:text-dark-400 max-w-md mb-8">
        A legkomolyabb darts oktato es training platform. Fejleszd a jatekodat profi szintre!
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link to="/register">
          <Button size="lg" leftIcon={<Target className="w-5 h-5" />}>
            Ingyenes regisztracio
          </Button>
        </Link>
        <Link to="/login">
          <Button variant="outline" size="lg">
            Bejelentkezes
          </Button>
        </Link>
      </div>

      <div className="mt-16 grid sm:grid-cols-3 gap-8 max-w-3xl">
        <FeatureCard
          icon={<Target className="w-6 h-6" />}
          title="60+ gyakorlat"
          description="Professzionalis edzesprogramok minden szinten"
        />
        <FeatureCard
          icon={<Gamepad2 className="w-6 h-6" />}
          title="Bot es PVP"
          description="Jatssz bot ellen vagy kihivhatsz masokat"
        />
        <FeatureCard
          icon={<Trophy className="w-6 h-6" />}
          title="Versenyek"
          description="Csatlakozz tornakhoz es klubokhoz"
        />
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: string;
  color: 'primary' | 'secondary' | 'accent' | 'success';
}

function StatCard({ icon, label, value, trend, color }: StatCardProps) {
  const colors = {
    primary: 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400',
    secondary: 'bg-secondary-50 dark:bg-secondary-900/20 text-secondary-600 dark:text-secondary-400',
    accent: 'bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400',
    success: 'bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400',
  };

  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute top-3 right-3 p-2 rounded-lg ${colors[color]}`}>{icon}</div>
      <p className="text-sm text-dark-500 dark:text-dark-400">{label}</p>
      <p className="text-2xl font-bold text-dark-900 dark:text-white mt-1">{value}</p>
      {trend && (
        <span className="text-xs text-success-500 font-medium mt-1 inline-block">{trend}</span>
      )}
    </Card>
  );
}

interface QuickActionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  to: string;
  badge?: string;
}

function QuickAction({ icon, title, description, to, badge }: QuickActionProps) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 p-3 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors group"
    >
      <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-dark-900 dark:text-white">{title}</p>
          {badge && <Badge variant="primary" size="sm">{badge}</Badge>}
        </div>
        <p className="text-sm text-dark-500 dark:text-dark-400 truncate">{description}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-dark-400 group-hover:translate-x-1 transition-transform" />
    </Link>
  );
}

interface ChallengeCardProps {
  title: string;
  description: string;
  progress: number;
  reward: string;
}

function ChallengeCard({ title, description, progress, reward }: ChallengeCardProps) {
  const getRewardDisplay = (rewardStr: string) => {
    try {
      const parts = rewardStr.split(' ');
      const amount = parts[0];
      const type = parts[1];

      const typeLabels: Record<string, string> = {
        'xp': 'XP',
        'coins': 'Erme',
        'points': 'Pont',
        'badge': 'Jelveny',
      };

      return `${amount} ${typeLabels[type] || type}`;
    } catch {
      return rewardStr;
    }
  };

  return (
    <div className="p-3 rounded-lg border border-dark-200 dark:border-dark-700">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-dark-900 dark:text-white">{title}</p>
          <p className="text-sm text-dark-500 dark:text-dark-400">{description}</p>
        </div>
        <Badge variant="secondary" size="sm">
          {getRewardDisplay(reward)}
        </Badge>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-dark-500">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 mb-3">
        {icon}
      </div>
      <h3 className="font-semibold text-dark-900 dark:text-white mb-1">{title}</h3>
      <p className="text-sm text-dark-500 dark:text-dark-400">{description}</p>
    </div>
  );
}
