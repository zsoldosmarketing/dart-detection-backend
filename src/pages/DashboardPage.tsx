import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Target,
  Gamepad2,
  Trophy,
  TrendingUp,
  Flame,
  ChevronRight,
  ChevronDown,
  Calendar,
  Clock,
  Play,
  Pause,
  Crosshair,
  Swords,
} from 'lucide-react';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PushNotificationPrompt } from '../components/ui/PushNotificationPrompt';
import { LandingPage } from './LandingPage';
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
  first_nine_average?: number;
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

interface MatchHistoryItem {
  id: string;
  room_id: string;
  opponent_id: string;
  game_type: string;
  game_mode: string;
  won: boolean;
  match_average: number;
  best_leg_average: number;
  legs_won: number;
  legs_lost: number;
  highest_checkout: number;
  checkouts_hit: number;
  total_doubles_hit: number;
  total_doubles_thrown: number;
  created_at: string;
}

export function DashboardPage() {
  const { user, profile, shouldShowPushPrompt, setShouldShowPushPrompt } = useAuthStore();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [activePrograms, setActivePrograms] = useState<ActiveProgram[]>([]);
  const [activeTrainings, setActiveTrainings] = useState<ActiveTraining[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [pausedGames, setPausedGames] = useState<PausedGame[]>([]);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryItem[]>([]);
  const [opponentNames, setOpponentNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    setIsLoading(true);

    const [challengesRes, programsRes, activeTrainingsRes, gamesRes, trainingsRes, statsRes, matchHistoryRes] = await Promise.all([
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
        .select('lifetime_average, lifetime_best_average, lifetime_checkout_percentage, lifetime_highest_checkout, lifetime_180s, current_win_streak, lifetime_win_percentage, first_nine_average')
        .eq('player_id', user.id)
        .maybeSingle(),
      supabase
        .from('match_statistics')
        .select('id, room_id, opponent_id, game_type, game_mode, won, match_average, best_leg_average, legs_won, legs_lost, highest_checkout, checkouts_hit, total_doubles_hit, total_doubles_thrown, created_at')
        .eq('player_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
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
          title: `${game.starting_score} ${t('game.leg')}`,
          subtitle: game.winner_id === user.id ? t('game.win') : t('game.loss'),
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

    if (matchHistoryRes.data) {
      setMatchHistory(matchHistoryRes.data as MatchHistoryItem[]);

      const opponentIds = [
        ...new Set(
          matchHistoryRes.data
            .map((m: any) => m.opponent_id)
            .filter((id: string | null) => id && id !== user.id)
        ),
      ] as string[];

      if (opponentIds.length > 0) {
        const { data: opponentProfiles } = await supabase
          .from('user_profile')
          .select('id, display_name, username')
          .in('id', opponentIds);

        if (opponentProfiles) {
          const names: Record<string, string> = {};
          opponentProfiles.forEach((p: any) => {
            names[p.id] = p.display_name || p.username || 'Ismeretlen';
          });
          setOpponentNames(names);
        }
      }
    }

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
        alert(data?.error || 'Hiba tortent a jatek folytatas kozben');
      }
    } catch (err) {
      console.error('Failed to resume game:', err);
      alert('Nem sikerult folytatni a jatekot');
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

  const getOpponentDisplayName = (opponentId: string | null): string => {
    if (!opponentId) return 'Bot';
    if (opponentNames[opponentId]) return opponentNames[opponentId];
    return 'Bot';
  };

  if (!user) {
    return <LandingPage />;
  }

  const today = format(new Date(), 'yyyy. MMMM d., EEEE', { locale: hu });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-slide-up stagger-1" style={{ animationFillMode: 'both' }}>
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">
            Szia, {profile?.display_name || profile?.username || 'Jatekos'}!
          </h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1 text-sm">
            {today}
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/training">
            <Button leftIcon={<Target className="w-4 h-4" />}>Edzes</Button>
          </Link>
          <Link to="/game">
            <Button variant="outline" leftIcon={<Gamepad2 className="w-4 h-4" />}>
              Jatek
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up stagger-2" style={{ animationFillMode: 'both' }}>
        <Card className="relative overflow-hidden">
          <div className="absolute top-3 right-3 p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wide">Match atlag</p>
          <p className="text-2xl font-bold text-dark-900 dark:text-white mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {playerStats?.lifetime_average?.toFixed(1) || profile?.average_score?.toFixed(1) || '0.0'}
          </p>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-3 right-3 p-2 rounded-lg bg-secondary-50 dark:bg-secondary-900/20 text-secondary-600 dark:text-secondary-400">
            <Crosshair className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wide">Elso 9</p>
          <p className="text-2xl font-bold text-dark-900 dark:text-white mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {playerStats?.first_nine_average?.toFixed(1) || '0.0'}
          </p>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-3 right-3 p-2 rounded-lg bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400">
            <Trophy className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wide">Gyozelmi arany</p>
          <p className="text-2xl font-bold text-dark-900 dark:text-white mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {playerStats?.lifetime_win_percentage
              ? `${playerStats.lifetime_win_percentage.toFixed(0)}%`
              : profile?.total_games_played
                ? `${((profile.total_wins / profile.total_games_played) * 100).toFixed(0)}%`
                : '0%'}
          </p>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-3 right-3 p-2 rounded-lg bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400">
            <Flame className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wide">180-asok</p>
          <p className="text-2xl font-bold text-dark-900 dark:text-white mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {playerStats?.lifetime_180s || 0}
          </p>
        </Card>
      </div>

      {pausedGames.length > 0 && (
        <Card className="border-2 border-warning-500/30 bg-warning-50/50 dark:bg-warning-900/10 animate-slide-up stagger-3" style={{ animationFillMode: 'both' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Pause className="w-5 h-5 text-warning-600" />
              <CardTitle>Felbehagyott jatekok</CardTitle>
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
                          {game.paused_by_me ? 'Te szuneteltetted' : 'Ellenfel szuneteltette'}
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
                    Folytatas
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="animate-slide-up stagger-4" style={{ animationFillMode: 'both' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-dark-900 dark:text-white">Legutobbi meccsek</h2>
          <Link to="/profile/history">
            <Button variant="ghost" size="sm" rightIcon={<ChevronRight className="w-4 h-4" />}>
              Osszes
            </Button>
          </Link>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : matchHistory.length === 0 ? (
          <Card>
            <div className="text-center py-6">
              <Swords className="w-10 h-10 text-dark-300 dark:text-dark-600 mx-auto mb-3" />
              <p className="text-dark-500 dark:text-dark-400 text-sm">
                Meg nincs meccs elozmenyed. Jatssz egy meccset!
              </p>
              <Link to="/game" className="inline-block mt-3">
                <Button size="sm" leftIcon={<Gamepad2 className="w-4 h-4" />}>Jatek inditasa</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="overflow-y-auto max-h-[50vh] scroll-list pr-1 space-y-2">
            {matchHistory.map((match) => {
              const isExpanded = selectedMatchId === match.id;
              const doublesPercent = match.total_doubles_thrown > 0
                ? ((match.total_doubles_hit / match.total_doubles_thrown) * 100).toFixed(0)
                : null;

              return (
                <div
                  key={match.id}
                  onClick={() => setSelectedMatchId(isExpanded ? null : match.id)}
                  className={`p-3 sm:p-4 rounded-xl border cursor-pointer transition-all duration-200 group ${
                    isExpanded
                      ? 'border-primary-500/30 dark:border-primary-500/30 bg-white dark:bg-dark-800 shadow-lg shadow-primary-500/5'
                      : 'border-dark-200/70 dark:border-dark-700/50 bg-white dark:bg-dark-800/80 hover:shadow-card-hover hover:border-dark-300 dark:hover:border-dark-600/70'
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="hidden sm:flex flex-col items-center text-center min-w-[3.5rem]">
                      <span className="text-xs font-medium text-dark-400 dark:text-dark-500">
                        {format(new Date(match.created_at), 'MMM', { locale: hu })}
                      </span>
                      <span className="text-lg font-bold text-dark-900 dark:text-white leading-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {format(new Date(match.created_at), 'd')}
                      </span>
                      <span className="text-xs text-dark-400 dark:text-dark-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {format(new Date(match.created_at), 'HH:mm')}
                      </span>
                    </div>

                    <div className={`w-1 h-12 rounded-full shrink-0 ${match.won ? 'bg-success-500' : 'bg-error-500'}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-dark-900 dark:text-white truncate">
                          {getOpponentDisplayName(match.opponent_id)}
                        </span>
                        <Badge variant={match.game_type === '501' ? 'primary' : 'secondary'} size="sm">
                          {match.game_type}
                        </Badge>
                        <Badge variant={match.won ? 'success' : 'error'} size="sm">
                          {match.won ? 'Gyozelem' : 'Vereseg'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-dark-500 dark:text-dark-400 sm:hidden mb-1">
                        <span>{format(new Date(match.created_at), 'MMM d, HH:mm', { locale: hu })}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-dark-600 dark:text-dark-300">
                          Atlag: <span className="font-semibold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>{match.match_average?.toFixed(1) || '0.0'}</span>
                        </span>
                        <span className="text-dark-600 dark:text-dark-300">
                          Legek: <span className="font-semibold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>{match.legs_won}-{match.legs_lost}</span>
                        </span>
                        {match.highest_checkout > 0 && (
                          <span className="text-dark-600 dark:text-dark-300">
                            Kiszallo: <span className="font-semibold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>{match.highest_checkout}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronDown className={`w-5 h-5 text-dark-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-dark-200/50 dark:border-dark-700/40 animate-in">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="text-center py-2 px-1 rounded-lg bg-dark-50 dark:bg-dark-700/40">
                          <p className="text-[10px] text-dark-400 uppercase tracking-wider mb-0.5">Legjobb leg</p>
                          <p className="text-base font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {match.best_leg_average?.toFixed(1) || '-'}
                          </p>
                        </div>
                        <div className="text-center py-2 px-1 rounded-lg bg-dark-50 dark:bg-dark-700/40">
                          <p className="text-[10px] text-dark-400 uppercase tracking-wider mb-0.5">Dupla %</p>
                          <p className="text-base font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {doublesPercent ? `${doublesPercent}%` : '-'}
                          </p>
                        </div>
                        <div className="text-center py-2 px-1 rounded-lg bg-dark-50 dark:bg-dark-700/40">
                          <p className="text-[10px] text-dark-400 uppercase tracking-wider mb-0.5">Kiszallok</p>
                          <p className="text-base font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {match.checkouts_hit || 0}
                          </p>
                        </div>
                        <div className="text-center py-2 px-1 rounded-lg bg-dark-50 dark:bg-dark-700/40">
                          <p className="text-[10px] text-dark-400 uppercase tracking-wider mb-0.5">Mod</p>
                          <p className="text-base font-bold text-dark-900 dark:text-white capitalize">
                            {match.game_mode === 'bot' ? 'Bot' : match.game_mode === 'pvp' ? 'Online' : 'Helyi'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 animate-slide-up stagger-5" style={{ animationFillMode: 'both' }}>
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

      {shouldShowPushPrompt && (
        <PushNotificationPrompt onDismiss={() => setShouldShowPushPrompt(false)} />
      )}
    </div>
  );
}
