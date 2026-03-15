import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { t } from '../lib/i18n';
import {
  History,
  Trophy,
  Target,
  TrendingUp,
  Calendar,
  ChevronRight,
  ChevronDown,
  Gamepad2,
  Bot,
  Users
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';

interface GameRoom {
  id: string;
  game_type: string;
  starting_score: number;
  legs_to_win: number;
  sets_to_win: number;
  mode: string;
  status: string;
  winner_id: string | null;
  bot_difficulty: string | null;
  created_at: string;
  completed_at: string | null;
}

interface GameStats {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  avgDartsPerLeg: number;
  highestCheckout: number;
  totalCheckouts: number;
}

export function GameHistoryPage() {
  const { user } = useAuthStore();
  const [games, setGames] = useState<GameRoom[]>([]);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'bot' | 'pvp' | 'local'>('all');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchGameHistory();
    }
  }, [user, filter]);

  const fetchGameHistory = async () => {
    if (!user) return;

    setIsLoading(true);

    let query = supabase
      .from('game_rooms')
      .select('*')
      .eq('created_by', user.id)
      .in('status', ['completed', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (filter !== 'all') {
      query = query.eq('mode', filter);
    }

    const { data: gamesData } = await query;

    if (gamesData) {
      setGames(gamesData);

      const completed = gamesData.filter(g => g.status === 'completed');
      const wins = completed.filter(g => g.winner_id === user.id).length;

      const { data: turnsData } = await supabase
        .from('game_turns')
        .select('is_checkout, total_score')
        .in('room_id', gamesData.map(g => g.id))
        .eq('is_checkout', true);

      const checkouts = turnsData || [];
      const highestCheckout = checkouts.length > 0
        ? Math.max(...checkouts.map(t => t.total_score))
        : 0;

      setStats({
        totalGames: completed.length,
        wins,
        losses: completed.length - wins,
        winRate: completed.length > 0 ? Math.round((wins / completed.length) * 100) : 0,
        avgDartsPerLeg: 0,
        highestCheckout,
        totalCheckouts: checkouts.length,
      });
    }

    setIsLoading(false);
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'bot': return <Bot className="w-4 h-4" />;
      case 'pvp': return <Users className="w-4 h-4" />;
      case 'local': return <Gamepad2 className="w-4 h-4" />;
      default: return <Gamepad2 className="w-4 h-4" />;
    }
  };

  const getModeLabel = (mode: string, botDifficulty: string | null) => {
    switch (mode) {
      case 'bot': return `Bot (${botDifficulty || 'medium'})`;
      case 'pvp': return t('game.mode_pvp');
      case 'local': return t('game.mode_local');
      default: return mode;
    }
  };

  const getResultBadge = (game: GameRoom) => {
    if (game.status === 'in_progress') {
      return <Badge variant="warning">{t('history.in_progress_badge')}</Badge>;
    }
    if (game.winner_id === user?.id) {
      return <Badge variant="success">{t('game.win')}</Badge>;
    }
    return <Badge variant="error">{t('game.loss')}</Badge>;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-500/10 dark:bg-primary-500/20 flex items-center justify-center">
          <History className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">{t('history.title')}</h1>
          <p className="text-dark-500 dark:text-dark-400">{t('history.subtitle')}</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-primary-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-dark-900 dark:text-white">{stats.totalGames}</p>
                <p className="text-xs text-dark-500">{t('history.total_games')}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success-500/10 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-success-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-dark-900 dark:text-white">{stats.winRate}%</p>
                <p className="text-xs text-dark-500">{t('history.win_rate')}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary-500/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-secondary-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-dark-900 dark:text-white">{stats.totalCheckouts}</p>
                <p className="text-xs text-dark-500">{t('history.checkouts')}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-accent-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-dark-900 dark:text-white">{stats.highestCheckout}</p>
                <p className="text-xs text-dark-500">{t('history.best_checkout')}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['all', 'bot', 'pvp', 'local'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f
                ? 'bg-primary-500 text-white'
                : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-300 hover:bg-dark-200 dark:hover:bg-dark-600'
            }`}
          >
            {f === 'all' ? t('game.mode_all') : f === 'bot' ? t('game.mode_bot') : f === 'pvp' ? t('game.mode_pvp') : t('game.mode_local')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : games.length === 0 ? (
        <Card className="p-8 text-center">
          <Gamepad2 className="w-12 h-12 text-dark-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">
            {t('history.empty_title')}
          </h3>
          <p className="text-dark-500 dark:text-dark-400 mb-4">
            {t('history.empty_desc')}
          </p>
          <Link
            to="/game"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            <Gamepad2 className="w-4 h-4" />
            {t('game.start')}
          </Link>
        </Card>
      ) : (
        <div className="overflow-y-auto max-h-[60vh] scroll-list pr-1 space-y-2">
          {games.map((game) => {
            const isExpanded = selectedGameId === game.id;
            return (
              <div
                key={game.id}
                onClick={() => setSelectedGameId(isExpanded ? null : game.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                  isExpanded
                    ? 'border-primary-500/30 dark:border-primary-500/30 bg-white dark:bg-dark-800 shadow-lg shadow-primary-500/5'
                    : 'border-dark-200/70 dark:border-dark-700/50 bg-white dark:bg-dark-800/80 hover:shadow-card-hover hover:border-dark-300 dark:hover:border-dark-600/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-dark-100 dark:bg-dark-700 flex items-center justify-center shrink-0">
                      {getModeIcon(game.mode)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {game.starting_score} - {game.legs_to_win} leg
                        </span>
                        {getResultBadge(game)}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-dark-500">
                        <span className="flex items-center gap-1">
                          {getModeIcon(game.mode)}
                          {getModeLabel(game.mode, game.bot_difficulty)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(game.created_at), 'MMM d, HH:mm', { locale: hu })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-dark-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-dark-200/50 dark:border-dark-700/40 animate-in">
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="text-center py-2 px-1 rounded-lg bg-dark-50 dark:bg-dark-700/40">
                        <p className="text-[10px] text-dark-400 uppercase tracking-wider mb-0.5">{t('history.sets')}</p>
                        <p className="text-base font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {game.sets_to_win}
                        </p>
                      </div>
                      <div className="text-center py-2 px-1 rounded-lg bg-dark-50 dark:bg-dark-700/40">
                        <p className="text-[10px] text-dark-400 uppercase tracking-wider mb-0.5">{t('history.game_type')}</p>
                        <p className="text-base font-bold text-dark-900 dark:text-white uppercase">
                          {game.game_type}
                        </p>
                      </div>
                      <div className="text-center py-2 px-1 rounded-lg bg-dark-50 dark:bg-dark-700/40">
                        <p className="text-[10px] text-dark-400 uppercase tracking-wider mb-0.5">{t('history.status')}</p>
                        <p className="text-base font-bold text-dark-900 dark:text-white capitalize">
                          {game.status === 'completed' ? t('history.completed') : t('history.in_progress')}
                        </p>
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Link
                        to={game.status === 'completed' ? `/match-stats/${game.id}` : `/game/${game.id}`}
                        className="block"
                      >
                        <button className="w-full py-2 px-4 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors flex items-center justify-center gap-2">
                          <ChevronRight className="w-4 h-4" />
                          {game.status === 'completed' ? t('history.details') : t('history.continue')}
                        </button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
