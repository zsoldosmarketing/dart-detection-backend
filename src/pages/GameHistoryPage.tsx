import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  History,
  Trophy,
  Target,
  TrendingUp,
  Calendar,
  ChevronRight,
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
      case 'pvp': return 'Online';
      case 'local': return 'Helyi';
      default: return mode;
    }
  };

  const getResultBadge = (game: GameRoom) => {
    if (game.status === 'in_progress') {
      return <Badge variant="warning">Folyamatban</Badge>;
    }
    if (game.winner_id === user?.id) {
      return <Badge variant="success">Gyozelem</Badge>;
    }
    return <Badge variant="error">Vereseg</Badge>;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-500/10 dark:bg-primary-500/20 flex items-center justify-center">
          <History className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Jatek elozmeny</h1>
          <p className="text-dark-500 dark:text-dark-400">Korabbi jatekaid es statisztikak</p>
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
                <p className="text-xs text-dark-500">Osszes jatek</p>
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
                <p className="text-xs text-dark-500">Gyozelmi arany</p>
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
                <p className="text-xs text-dark-500">Kiszallok</p>
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
                <p className="text-xs text-dark-500">Legjobb kiszallo</p>
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
            {f === 'all' ? 'Mind' : f === 'bot' ? 'Bot' : f === 'pvp' ? 'Online' : 'Helyi'}
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
            Nincs jatek elozmeny
          </h3>
          <p className="text-dark-500 dark:text-dark-400 mb-4">
            Indits egy jatekot, hogy megjelenjen itt!
          </p>
          <Link
            to="/game"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            <Gamepad2 className="w-4 h-4" />
            Jatek inditasa
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {games.map((game) => (
            <Link
              key={game.id}
              to={game.status === 'completed' ? `/match-stats/${game.id}` : `/game/${game.id}`}
            >
              <Card className="p-4 hover:border-primary-500/50 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-dark-100 dark:bg-dark-700 flex items-center justify-center">
                      {getModeIcon(game.mode)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-dark-900 dark:text-white">
                          {game.starting_score} - {game.legs_to_win} leg
                        </span>
                        {getResultBadge(game)}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-dark-500">
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
                  <ChevronRight className="w-5 h-5 text-dark-400" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
