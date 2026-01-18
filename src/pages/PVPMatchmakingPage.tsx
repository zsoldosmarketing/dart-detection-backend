import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Swords,
  Users,
  Search,
  Loader2,
  X,
  Target,
  Trophy,
  Clock,
  User,
  Send,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { PushNotificationPrompt } from '../components/ui/PushNotificationPrompt';
import { GameInviteCard } from '../components/game/GameInviteCard';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

interface OnlinePlayer {
  id: string;
  display_name: string;
  avatar_url: string | null;
  pvp_average: number | null;
  pvp_games_played: number;
  is_searching: boolean;
}

interface LobbyEntry {
  id: string;
  user_id: string;
  game_type: string;
  starting_score: number;
  legs_to_win: number;
  double_out: boolean;
  created_at: string;
  expires_at?: string;
  user_profile?: {
    display_name: string;
    avatar_url: string | null;
  };
  player_stats?: {
    pvp_average: number | null;
    pvp_games_played: number;
  };
}

interface GameInvite {
  id: string;
  room_id: string;
  inviter_id: string;
  invitee_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: string;
  expires_at: string;
  inviter?: {
    display_name: string;
    avatar_url: string | null;
    pvp_average?: number | null;
    pvp_games_played?: number;
  };
  room?: {
    game_type: string;
    game_variant: string;
    starting_score: number;
  };
}

type GameType = 'x01' | 'cricket';
type X01Variant = 301 | 501 | 701;

export function PVPMatchmakingPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [isSearching, setIsSearching] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [lobbyEntries, setLobbyEntries] = useState<LobbyEntry[]>([]);
  const [pendingInvites, setPendingInvites] = useState<GameInvite[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameType>('x01');
  const [selectedVariant, setSelectedVariant] = useState<X01Variant>(501);
  const [playerSearch, setPlayerSearch] = useState('');
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);
  const [lobbyTimeRemaining, setLobbyTimeRemaining] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchOnlinePlayers();
    fetchLobbyEntries();
    fetchPendingInvites();

    const interval = setInterval(() => {
      fetchOnlinePlayers();
      fetchLobbyEntries();
      fetchPendingInvites();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isSearching) {
      timer = setInterval(() => {
        setSearchTime((t) => t + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isSearching]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    if (lobbyEntries.length > 0) {
      const updateTimeRemaining = () => {
        const remaining: Record<string, number> = {};
        lobbyEntries.forEach((entry) => {
          if (entry.expires_at) {
            const expiresAt = new Date(entry.expires_at).getTime();
            const now = Date.now();
            remaining[entry.id] = Math.max(0, Math.floor((expiresAt - now) / 1000));
          }
        });
        setLobbyTimeRemaining(remaining);
      };

      updateTimeRemaining();
      timer = setInterval(updateTimeRemaining, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [lobbyEntries]);

  const fetchOnlinePlayers = async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('user_profile')
      .select(`
        id,
        display_name,
        avatar_url,
        player_statistics_summary (
          human_average,
          human_matches_played
        )
      `)
      .neq('id', user?.id || '')
      .gte('last_active_at', fiveMinutesAgo)
      .limit(20);

    if (data) {
      const players: OnlinePlayer[] = data.map((p: any) => ({
        id: p.id,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        pvp_average: p.player_statistics_summary?.human_average || null,
        pvp_games_played: p.player_statistics_summary?.human_matches_played || 0,
        is_searching: false,
      }));
      setOnlinePlayers(players);
    }
  };

  const fetchLobbyEntries = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('pvp_lobby')
      .select(`
        *,
        user_profile:user_id (
          id,
          display_name,
          username,
          avatar_url
        )
      `)
      .eq('status', 'waiting')
      .neq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching lobby entries:', error);
      return;
    }

    if (data) {
      const userIds = data.map((entry: any) => entry.user_id);

      const { data: statsData } = await supabase
        .from('player_statistics_summary')
        .select('player_id, human_average, human_matches_played')
        .in('player_id', userIds);

      const statsMap = new Map(
        (statsData || []).map((stat: any) => [stat.player_id, stat])
      );

      const entries: LobbyEntry[] = data.map((entry: any) => {
        const stats = statsMap.get(entry.user_id);
        return {
          ...entry,
          player_stats: {
            pvp_average: stats?.human_average || null,
            pvp_games_played: stats?.human_matches_played || 0,
          },
        };
      });

      console.log(`Fetched ${entries.length} lobby entries`);
      setLobbyEntries(entries);
    }
  };

  const fetchPendingInvites = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('game_invites')
      .select(`
        *,
        inviter:user_profile!game_invites_inviter_id_fkey(
          display_name,
          avatar_url,
          player_statistics_summary (
            human_average,
            human_matches_played
          )
        ),
        room:game_rooms(game_type, game_variant, starting_score)
      `)
      .eq('invitee_id', user.id)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (data) {
      const enrichedInvites = data.map((invite: any) => ({
        ...invite,
        inviter: invite.inviter ? {
          display_name: invite.inviter.display_name,
          avatar_url: invite.inviter.avatar_url,
          pvp_average: invite.inviter.player_statistics_summary?.human_average || null,
          pvp_games_played: invite.inviter.player_statistics_summary?.human_matches_played || 0,
        } : undefined,
      }));
      setPendingInvites(enrichedInvites as GameInvite[]);
    }
  };

  const startMatchmaking = useCallback(async () => {
    setIsSearching(true);
    setSearchTime(0);

    const { data: room, error } = await supabase
      .from('game_rooms')
      .insert({
        game_type: selectedGame,
        game_variant: selectedGame === 'x01' ? `${selectedVariant}` : 'standard',
        starting_score: selectedGame === 'x01' ? selectedVariant : 0,
        room_type: 'pvp',
        status: 'waiting',
        host_id: user?.id,
        max_players: 2,
      })
      .select()
      .single();

    if (error || !room) {
      setIsSearching(false);
      return;
    }

    const checkMatch = async () => {
      const { data: updatedRoom } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('id', room.id)
        .single();

      if (updatedRoom?.status === 'playing') {
        setIsSearching(false);
        navigate(`/game/${room.id}`);
      }
    };

    const matchInterval = setInterval(checkMatch, 2000);

    setTimeout(() => {
      clearInterval(matchInterval);
      setIsSearching(false);
    }, 120000);
  }, [selectedGame, selectedVariant, user, navigate]);

  const cancelMatchmaking = async () => {
    setIsSearching(false);
    setSearchTime(0);
  };

  const sendInvite = async (playerId: string) => {
    if (!user) return;
    setSendingInvite(playerId);

    try {
      const { data: room, error: roomError } = await supabase
        .from('game_rooms')
        .insert({
          game_type: selectedGame,
          game_variant: selectedGame === 'x01' ? `${selectedVariant}` : 'standard',
          starting_score: selectedGame === 'x01' ? selectedVariant : 0,
          room_type: 'private',
          status: 'waiting',
          host_id: user.id,
          max_players: 2,
        })
        .select()
        .single();

      if (roomError || !room) throw roomError;

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const { error: inviteError } = await supabase.from('game_invites').insert({
        room_id: room.id,
        inviter_id: user.id,
        invitee_id: playerId,
        status: 'pending',
        expires_at: expiresAt,
      });

      if (inviteError) throw inviteError;

      navigate(`/game/${room.id}`);
    } catch (err) {
      console.error('Failed to send invite:', err);
    } finally {
      setSendingInvite(null);
    }
  };

  const challengePlayer = async (lobbyId: string) => {
    if (!user) return;
    setSendingInvite(lobbyId);

    try {
      const { error } = await supabase
        .from('pvp_challenges')
        .insert({
          challenger_id: user.id,
          opponent_id: lobbyEntries.find((e) => e.id === lobbyId)?.user_id,
          lobby_id: lobbyId,
          status: 'pending',
        });

      if (error) throw error;

      alert('Kihívás elküldve! A válaszról értesítést fogsz kapni.');
    } catch (err) {
      console.error('Failed to challenge:', err);
    } finally {
      setSendingInvite(null);
    }
  };

  const handleInviteRespond = (inviteId: string, accepted: boolean) => {
    setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeRemaining = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredPlayers = onlinePlayers.filter((p) =>
    p.display_name.toLowerCase().includes(playerSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">
            Online Jatekosok
          </h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            Keress ellenfelet vagy fogadj el meghivasokat
          </p>
        </div>
      </div>

      {pendingInvites.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-dark-900 dark:text-white">
            Beerkezett meghivok ({pendingInvites.length})
          </h2>
          {pendingInvites.map((invite) => (
            <GameInviteCard
              key={invite.id}
              invite={invite}
              onRespond={handleInviteRespond}
            />
          ))}
        </div>
      )}

      <Card>
        <h2 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
          Jatek beallitasok
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => setSelectedGame('x01')}
            className={`p-4 rounded-xl border-2 transition-all ${
              selectedGame === 'x01'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-dark-200 dark:border-dark-700 hover:border-dark-300 dark:hover:border-dark-600'
            }`}
          >
            <Target className={`w-6 h-6 mx-auto mb-2 ${
              selectedGame === 'x01' ? 'text-primary-600' : 'text-dark-500'
            }`} />
            <span className={`text-sm font-medium ${
              selectedGame === 'x01' ? 'text-primary-600' : 'text-dark-700 dark:text-dark-300'
            }`}>
              X01
            </span>
          </button>

          <button
            onClick={() => setSelectedGame('cricket')}
            className={`p-4 rounded-xl border-2 transition-all ${
              selectedGame === 'cricket'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-dark-200 dark:border-dark-700 hover:border-dark-300 dark:hover:border-dark-600'
            }`}
          >
            <Trophy className={`w-6 h-6 mx-auto mb-2 ${
              selectedGame === 'cricket' ? 'text-primary-600' : 'text-dark-500'
            }`} />
            <span className={`text-sm font-medium ${
              selectedGame === 'cricket' ? 'text-primary-600' : 'text-dark-700 dark:text-dark-300'
            }`}>
              Cricket
            </span>
          </button>
        </div>

        {selectedGame === 'x01' && (
          <div className="flex gap-2 mb-6">
            {([301, 501, 701] as X01Variant[]).map((variant) => (
              <button
                key={variant}
                onClick={() => setSelectedVariant(variant)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedVariant === variant
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-700'
                }`}
              >
                {variant}
              </button>
            ))}
          </div>
        )}

        {isSearching ? (
          <div className="text-center py-8">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-primary-200 dark:border-primary-900 rounded-full" />
              <div className="absolute inset-0 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Search className="w-8 h-8 text-primary-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">
              Ellenfél keresése...
            </h3>
            <p className="text-dark-500 dark:text-dark-400 mb-2">
              {formatTime(searchTime)} eltelt
            </p>
            <Button
              variant="outline"
              leftIcon={<X className="w-4 h-4" />}
              onClick={cancelMatchmaking}
            >
              Megse
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            leftIcon={<Search className="w-5 h-5" />}
            onClick={startMatchmaking}
          >
            Ellenfél keresése
          </Button>
        )}
      </Card>

      {lobbyEntries.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-dark-900 dark:text-white flex items-center gap-2">
              <Swords className="w-5 h-5 text-warning-600" />
              Varakozó jatekosok ({lobbyEntries.length})
            </h2>
          </div>

          <p className="text-sm text-dark-600 dark:text-dark-400 mb-4">
            Ezek a jatekosok mar megadtak a jatek beallitasaikat es varjak a kihivasod!
          </p>

          <div className="space-y-2">
            {lobbyEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 rounded-lg bg-warning-50 dark:bg-warning-900/10 border border-warning-200 dark:border-warning-800 hover:bg-warning-100 dark:hover:bg-warning-900/20 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {entry.user_profile?.avatar_url ? (
                    <img
                      src={entry.user_profile.avatar_url}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-warning-200 dark:bg-warning-800 flex items-center justify-center">
                      <User className="w-5 h-5 text-warning-700" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-dark-900 dark:text-white">
                        {entry.user_profile?.display_name || 'Ismeretlen'}
                      </span>
                      {entry.player_stats?.pvp_average && entry.player_stats.pvp_average > 0 && (
                        <Badge variant="secondary" size="sm">
                          <Target className="w-3 h-3 mr-1" />
                          {entry.player_stats.pvp_average.toFixed(1)} atlag
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-dark-600 dark:text-dark-400 flex-wrap">
                      <Badge variant="default" size="sm">{entry.starting_score}</Badge>
                      <Badge variant="secondary" size="sm">L{entry.legs_to_win}</Badge>
                      {entry.double_out && <Badge variant="success" size="sm">DO</Badge>}
                      {lobbyTimeRemaining[entry.id] > 0 && (
                        <Badge variant="warning" size="sm" className="font-mono">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatTimeRemaining(lobbyTimeRemaining[entry.id])}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={
                    sendingInvite === entry.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Swords className="w-4 h-4" />
                    )
                  }
                  onClick={() => challengePlayer(entry.id)}
                  disabled={sendingInvite === entry.id}
                  className="whitespace-nowrap"
                >
                  Kihivas
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-dark-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            Online jatekosok ({onlinePlayers.length})
          </h2>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-dark-500">Elo</span>
          </div>
        </div>

        <Input
          placeholder="Jatekos keresese..."
          value={playerSearch}
          onChange={(e) => setPlayerSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          className="mb-4"
        />

        {filteredPlayers.length === 0 ? (
          <div className="text-center py-8 text-dark-500 dark:text-dark-400">
            Nincs elerheto online jatekos
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between p-3 rounded-lg bg-dark-50 dark:bg-dark-800 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {player.avatar_url ? (
                    <img
                      src={player.avatar_url}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-dark-200 dark:bg-dark-600 flex items-center justify-center">
                      <User className="w-5 h-5 text-dark-500" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-dark-900 dark:text-white">
                        {player.display_name}
                      </span>
                      {player.is_searching && (
                        <Badge variant="success" size="sm">Keres</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-dark-500">
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        {player.pvp_average ? player.pvp_average.toFixed(1) : 'N/A'} átlag
                      </span>
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        {player.pvp_games_played} PVP játék
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={
                    sendingInvite === player.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )
                  }
                  onClick={() => sendInvite(player.id)}
                  disabled={sendingInvite === player.id}
                >
                  Meghivas
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {isSearching && <PushNotificationPrompt context="pvp" />}
    </div>
  );
}
