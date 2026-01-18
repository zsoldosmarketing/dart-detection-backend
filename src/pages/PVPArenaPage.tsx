import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Swords,
  Plus,
  Filter,
  Clock,
  Trophy,
  Target,
  Users,
  X,
  Check,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Loader2,
  UserPlus,
} from 'lucide-react';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { formatDistanceToNow } from 'date-fns';
import { hu } from 'date-fns/locale';
import { ActiveGamesModal } from '../components/pvp/ActiveGamesModal';

type SkillFilter = 'any' | 'similar' | 'higher' | 'lower';

interface LobbyEntry {
  id: string;
  user_id: string;
  game_type: string;
  starting_score: number;
  legs_to_win: number;
  sets_to_win: number;
  double_in: boolean;
  double_out: boolean;
  skill_filter: SkillFilter;
  created_at: string;
  expires_at: string;
  user_profile?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
  player_stats?: {
    pvp_average: number | null;
    pvp_games_played: number;
    lifetime_average: number | null;
  };
}

interface Challenge {
  id: string;
  challenger_id: string;
  opponent_id: string;
  lobby_id: string;
  status: string;
  created_at: string;
  expires_at: string;
  challenger?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
  challenger_stats?: {
    pvp_average: number | null;
    pvp_games_played: number;
    lifetime_average: number | null;
  };
  lobby?: LobbyEntry;
}

export function PVPArenaPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'browse' | 'waiting' | 'challenges'>('browse');
  const [lobbyEntries, setLobbyEntries] = useState<LobbyEntry[]>([]);
  const [myLobby, setMyLobby] = useState<LobbyEntry | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  const [showCreateLobby, setShowCreateLobby] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [lobbyTimeRemaining, setLobbyTimeRemaining] = useState<Record<string, number>>({});

  const [startingScore, setStartingScore] = useState(501);
  const [legs, setLegs] = useState(1);
  const [sets, setSets] = useState(1);
  const [doubleOut, setDoubleOut] = useState(true);
  const [doubleIn, setDoubleIn] = useState(false);
  const [skillFilter, setSkillFilter] = useState<SkillFilter>('any');
  const [isCreating, setIsCreating] = useState(false);

  const [waitingForAcceptance, setWaitingForAcceptance] = useState(false);
  const [myChallengeId, setMyChallengeId] = useState<string | null>(null);
  const [waitTimeRemaining, setWaitTimeRemaining] = useState<number>(0);
  const [challengeTimeRemaining, setChallengeTimeRemaining] = useState<Record<string, number>>({});
  const [activeGames, setActiveGames] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchData();
      const dataInterval = setInterval(fetchData, 5000);
      const cleanupInterval = setInterval(() => {
        supabase.rpc('cleanup_expired_pvp_entries');
        supabase.rpc('check_game_timeouts');
      }, 60000);

      return () => {
        clearInterval(dataInterval);
        clearInterval(cleanupInterval);
      };
    }
  }, [user, activeTab]);


  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    if (myLobby?.expires_at) {
      const updateTimeRemaining = () => {
        const expiresAt = new Date(myLobby.expires_at).getTime();
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
        setTimeRemaining(remaining);

        if (remaining === 0) {
          setMyLobby(null);
        }
      };

      updateTimeRemaining();
      timer = setInterval(updateTimeRemaining, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [myLobby?.expires_at]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    if (lobbyEntries.length > 0) {
      const updateLobbyTimeRemaining = () => {
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

      updateLobbyTimeRemaining();
      timer = setInterval(updateLobbyTimeRemaining, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [lobbyEntries]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    if (challenges.length > 0) {
      const updateChallengeTimeRemaining = () => {
        const remaining: Record<string, number> = {};
        let hasExpired = false;

        challenges.forEach((challenge) => {
          if (challenge.expires_at) {
            const expiresAt = new Date(challenge.expires_at).getTime();
            const now = Date.now();
            const timeLeft = Math.max(0, Math.floor((expiresAt - now) / 1000));
            remaining[challenge.id] = timeLeft;

            if (timeLeft === 0 && challengeTimeRemaining[challenge.id] > 0) {
              hasExpired = true;
            }
          }
        });

        setChallengeTimeRemaining(remaining);

        if (hasExpired) {
          setTimeout(() => {
            fetchData();
          }, 1000);
        }
      };

      updateChallengeTimeRemaining();
      timer = setInterval(updateChallengeTimeRemaining, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [challenges, challengeTimeRemaining]);

  useEffect(() => {
    if (!waitingForAcceptance || !myChallengeId) return;

    const checkChallengeStatus = async () => {
      const { data: challenge } = await supabase
        .from('pvp_challenges')
        .select('status, room_id, expires_at')
        .eq('id', myChallengeId)
        .maybeSingle();

      if (!challenge) {
        setWaitingForAcceptance(false);
        setMyChallengeId(null);
        return;
      }

      if (challenge.expires_at && new Date(challenge.expires_at) < new Date()) {
        setWaitingForAcceptance(false);
        setMyChallengeId(null);
        return;
      }

      if (challenge.status === 'accepted' && challenge.room_id) {
        setWaitingForAcceptance(false);
        setMyChallengeId(null);
        navigate(`/game/${challenge.room_id}`);
      } else if (challenge.status === 'declined' || challenge.status === 'expired') {
        setWaitingForAcceptance(false);
        setMyChallengeId(null);
      }
    };

    const pollInterval = setInterval(checkChallengeStatus, 2000);

    const countdownTimer = setInterval(() => {
      setWaitTimeRemaining((prev) => {
        if (prev <= 1) {
          setWaitingForAcceptance(false);
          setMyChallengeId(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    checkChallengeStatus();

    return () => {
      clearInterval(pollInterval);
      clearInterval(countdownTimer);
    };
  }, [waitingForAcceptance, myChallengeId, navigate]);


  const fetchData = async (isManual = false) => {
    if (!user) return;

    if (isManual) {
      setIsManualRefresh(true);
    } else {
      setIsLoading(true);
    }

    if (activeTab === 'browse') {
      await fetchLobbyEntries();
    } else if (activeTab === 'waiting') {
      await fetchMyLobby();
      await fetchIncomingChallenges();
    } else if (activeTab === 'challenges') {
      await fetchMyChallenges();
    }

    if (isManual) {
      setIsManualRefresh(false);
    } else {
      setIsLoading(false);
    }
  };

  const handleManualRefresh = () => {
    fetchData(true);
  };

  const fetchLobbyEntries = async () => {
    if (!user?.id) return;

    const { data: myMatchedLobby } = await supabase
      .from('pvp_lobby')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'matched')
      .maybeSingle();

    if (myMatchedLobby) {
      const { data: challenge } = await supabase
        .from('pvp_challenges')
        .select('room_id, game_rooms!inner(started_at, status)')
        .eq('lobby_id', myMatchedLobby.id)
        .eq('status', 'accepted')
        .maybeSingle();

      if (challenge?.room_id) {
        const gameStarted = (challenge as any).game_rooms?.started_at;
        if (gameStarted) {
          const gameAge = Date.now() - new Date(gameStarted).getTime();
          const hoursOld = gameAge / (1000 * 60 * 60);

          if (hoursOld < 1) {
            navigate(`/game/${challenge.room_id}`);
            return;
          }
        }
      }
    }

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
      .neq('user_id', user?.id || '')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching lobby entries:', error);
      return;
    }

    if (data) {
      const userIds = data.map((entry: any) => entry.user_id);

      const { data: statsData } = await supabase
        .from('player_statistics_summary')
        .select('player_id, human_average, human_matches_played, lifetime_average')
        .in('player_id', userIds);

      const statsMap = new Map(
        (statsData || []).map((stat: any) => [stat.player_id, stat])
      );

      const entriesWithStats = data.map((entry: any) => {
        const stats = statsMap.get(entry.user_id);
        return {
          ...entry,
          player_stats: {
            pvp_average: stats?.human_average || null,
            pvp_games_played: stats?.human_matches_played || 0,
            lifetime_average: stats?.lifetime_average || null,
          },
        };
      });

      console.log(`Fetched ${entriesWithStats.length} lobby entries`, entriesWithStats.slice(0, 2));
      setLobbyEntries(entriesWithStats);
    }
  };

  const fetchMyLobby = async () => {
    if (!user?.id) return;

    const { data: matchedLobby } = await supabase
      .from('pvp_lobby')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'matched')
      .maybeSingle();

    if (matchedLobby) {
      const { data: challenge } = await supabase
        .from('pvp_challenges')
        .select('room_id, game_rooms!inner(started_at, status)')
        .eq('lobby_id', matchedLobby.id)
        .eq('status', 'accepted')
        .maybeSingle();

      if (challenge?.room_id) {
        const gameStarted = (challenge as any).game_rooms?.started_at;
        if (gameStarted) {
          const gameAge = Date.now() - new Date(gameStarted).getTime();
          const hoursOld = gameAge / (1000 * 60 * 60);

          if (hoursOld < 1) {
            navigate(`/game/${challenge.room_id}`);
            return;
          }
        }
      }
    }

    const { data, error } = await supabase
      .from('pvp_lobby')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'waiting')
      .maybeSingle();

    if (error) {
      console.error('Error fetching my lobby:', error);
      return;
    }

    if (data) {
      const { data: statsData } = await supabase
        .from('player_statistics_summary')
        .select('player_id, human_average, human_matches_played, lifetime_average')
        .eq('player_id', user.id)
        .maybeSingle();

      const lobbyWithStats = {
        ...data,
        player_stats: {
          pvp_average: statsData?.human_average || null,
          pvp_games_played: statsData?.human_matches_played || 0,
          lifetime_average: statsData?.lifetime_average || null,
        },
      };

      console.log('Found my lobby:', lobbyWithStats);
      setMyLobby(lobbyWithStats);
    } else if (!myLobby || myLobby.status !== 'waiting') {
      console.log('No lobby found, clearing state');
      setMyLobby(null);
    } else {
      console.log('No lobby found but keeping existing state');
    }
  };

  const fetchIncomingChallenges = async () => {
    if (!myLobby) return;

    const { data, error } = await supabase
      .from('pvp_challenges')
      .select(`
        *,
        challenger:challenger_id (
          id,
          display_name,
          username,
          avatar_url
        )
      `)
      .eq('lobby_id', myLobby.id)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching challenges:', error);
      return;
    }

    if (data && data.length > 0) {
      const challengerIds = data.map((c: any) => c.challenger_id);

      const { data: statsData } = await supabase
        .from('player_statistics_summary')
        .select('player_id, human_average, human_matches_played, lifetime_average')
        .in('player_id', challengerIds);

      const statsMap = new Map(
        (statsData || []).map((stat: any) => [stat.player_id, stat])
      );

      const challengesWithStats = data.map((challenge: any) => {
        const stats = statsMap.get(challenge.challenger_id);
        return {
          ...challenge,
          challenger_stats: {
            pvp_average: stats?.human_average || null,
            pvp_games_played: stats?.human_matches_played || 0,
            lifetime_average: stats?.lifetime_average || null,
          },
        };
      });

      console.log(`Fetched ${challengesWithStats.length} challenges`);
      setChallenges(challengesWithStats as Challenge[]);
    } else {
      setChallenges([]);
    }
  };

  const fetchMyChallenges = async () => {
    if (!user?.id) return;

    const { data: challengesData } = await supabase
      .from('pvp_challenges')
      .select(`
        *,
        lobby:lobby_id (
          *,
          user_profile:user_id (
            display_name,
            username,
            avatar_url,
            player_statistics_summary (
              human_average,
              human_matches_played
            )
          )
        ),
        game_rooms!left(started_at, status)
      `)
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false });

    const { data: activeGames } = await supabase
      .from('game_rooms')
      .select(`
        id,
        game_type,
        starting_score,
        legs_to_win,
        sets_to_win,
        status,
        mode,
        started_at,
        updated_at,
        game_players!inner(
          user_id,
          player_order,
          current_score,
          display_name,
          user_profile:user_id(
            display_name,
            username,
            avatar_url
          )
        )
      `)
      .in('status', ['in_progress', 'paused_disconnect', 'paused_mutual'])
      .in('mode', ['pvp', 'direct_challenge']);

    const myActiveGames = (activeGames || []).filter((game: any) =>
      game.game_players.some((p: any) => p.user_id === user.id)
    );

    if (challengesData) {
      const accepted = challengesData.filter(c => c.status === 'accepted' && c.room_id);
      if (accepted.length > 0 && accepted[0].room_id) {
        const gameStarted = (accepted[0] as any).game_rooms?.started_at;
        const gameRoom = (accepted[0] as any).game_rooms;
        if (gameStarted && gameRoom?.status !== 'abandoned') {
          const gameAge = Date.now() - new Date(gameStarted).getTime();
          const hoursOld = gameAge / (1000 * 60 * 60);

          if (hoursOld < 1) {
            navigate(`/game/${accepted[0].room_id}`);
            return;
          }
        }
      }
      setChallenges(challengesData as Challenge[]);
    }

    setActiveGames(myActiveGames || []);
  };

  const createLobby = async () => {
    if (!user) return;

    setIsCreating(true);
    try {
      await supabase
        .from('pvp_lobby')
        .update({ status: 'cancelled' })
        .eq('user_id', user.id)
        .eq('status', 'waiting');

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);

      const { data, error } = await supabase
        .from('pvp_lobby')
        .insert({
          user_id: user.id,
          game_type: 'x01',
          starting_score: startingScore,
          legs_to_win: legs,
          sets_to_win: sets,
          double_in: doubleIn,
          double_out: doubleOut,
          skill_filter: skillFilter,
          status: 'waiting',
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Lobby creation error:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from lobby creation');
      }

      console.log('Lobby created successfully:', data);
      setMyLobby(data);
      setShowCreateLobby(false);

      await new Promise(resolve => setTimeout(resolve, 100));

      setActiveTab('waiting');
    } catch (err: any) {
      console.error('Failed to create lobby:', err);
      alert(`Nem sikerült létrehozni a lobbyt: ${err.message || 'Ismeretlen hiba'}`);
    } finally {
      setIsCreating(false);
    }
  };

  const cancelLobby = async () => {
    if (!myLobby) return;

    await supabase
      .from('pvp_lobby')
      .update({ status: 'cancelled' })
      .eq('id', myLobby.id);

    setMyLobby(null);
    setActiveTab('browse');
  };

  const challengePlayer = async (lobbyId: string) => {
    if (!user) return;

    console.log('challengePlayer called:', { lobbyId, lobbyEntriesCount: lobbyEntries.length, userId: user.id });

    try {
      const lobbyEntry = lobbyEntries.find((e) => e.id === lobbyId);
      console.log('Found lobby entry:', lobbyEntry);

      if (!lobbyEntry || !lobbyEntry.user_id) {
        console.error('Lobby entry not found or missing user_id:', { lobbyId, lobbyEntry });
        alert('Nem található a lobby vagy hiányzik a felhasználó adat');
        return;
      }

      if (lobbyEntry.user_id === user.id) {
        alert('Nem hívhatod ki saját magad!');
        return;
      }

      const { data, error } = await supabase
        .from('pvp_challenges')
        .insert({
          challenger_id: user.id,
          opponent_id: lobbyEntry.user_id,
          lobby_id: lobbyId,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        console.error('Challenge insert error:', error);
        throw error;
      }

      setMyChallengeId(data.id);
      setWaitingForAcceptance(true);
      setWaitTimeRemaining(120);
    } catch (err: any) {
      console.error('Failed to challenge:', err);
      alert(`Nem sikerült elküldeni a kihívást: ${err?.message || 'Ismeretlen hiba'}`);
    }
  };

  const respondToChallenge = async (challengeId: string, accept: boolean) => {
    if (!user) return;

    try {
      if (accept) {
        const challenge = challenges.find((c) => c.id === challengeId);
        if (!challenge || !myLobby) return;

        const { data: room, error: roomError } = await supabase
          .from('game_rooms')
          .insert({
            game_type: 'x01',
            starting_score: myLobby.starting_score,
            legs_to_win: myLobby.legs_to_win,
            sets_to_win: myLobby.sets_to_win,
            double_in: myLobby.double_in,
            double_out: myLobby.double_out,
            mode: 'pvp',
            status: 'in_progress',
            created_by: user.id,
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (roomError) throw roomError;

        await supabase.from('game_players').insert([
          {
            room_id: room.id,
            user_id: user.id,
            is_bot: false,
            player_order: 1,
            current_score: myLobby.starting_score,
          },
          {
            room_id: room.id,
            user_id: challenge.challenger_id,
            is_bot: false,
            player_order: 2,
            current_score: myLobby.starting_score,
          },
        ]);

        await supabase.from('game_state').insert({
          room_id: room.id,
          current_player_order: Math.random() < 0.5 ? 1 : 2,
          current_leg: 1,
          current_set: 1,
        });

        await supabase
          .from('pvp_challenges')
          .update({ status: 'accepted', room_id: room.id })
          .eq('id', challengeId);

        await supabase
          .from('pvp_lobby')
          .update({ status: 'matched' })
          .eq('id', myLobby.id);

        navigate(`/game/${room.id}`);
      } else {
        await supabase
          .from('pvp_challenges')
          .update({ status: 'declined' })
          .eq('id', challengeId);

        setChallenges(challenges.filter((c) => c.id !== challengeId));
      }
    } catch (err) {
      console.error('Failed to respond to challenge:', err);
    }
  };

  const getSkillFilterLabel = (filter: SkillFilter) => {
    switch (filter) {
      case 'similar':
        return 'Hasonló szintű';
      case 'higher':
        return 'Magasabb szintű';
      case 'lower':
        return 'Alacsonyabb szintű';
      default:
        return 'Bárki';
    }
  };

  const getSkillFilterIcon = (filter: SkillFilter) => {
    switch (filter) {
      case 'higher':
        return <TrendingUp className="w-4 h-4" />;
      case 'lower':
        return <TrendingDown className="w-4 h-4" />;
      case 'similar':
        return <Minus className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const formatTimeRemaining = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-dark-900 dark:text-white flex items-center gap-2">
          <Swords className="w-7 h-7 text-primary-600" />
          PVP Aréna
        </h1>
        <p className="text-dark-500 dark:text-dark-400 mt-1">
          Találj ellenfelet és versenyezz más játékosokkal
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 md:flex md:gap-2">
        <button
          onClick={() => setActiveTab('browse')}
          className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-2 md:px-4 py-2.5 rounded-lg font-medium transition-all ${
            activeTab === 'browse'
              ? 'bg-primary-600 text-white shadow-md'
              : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600'
          }`}
        >
          <Filter className="w-5 h-5 md:w-4 md:h-4" />
          <span className="text-xs md:text-base md:whitespace-nowrap">Játékosok</span>
        </button>
        <button
          onClick={() => setActiveTab('waiting')}
          className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-2 md:px-4 py-2.5 rounded-lg font-medium transition-all relative ${
            activeTab === 'waiting'
              ? 'bg-primary-600 text-white shadow-md'
              : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600'
          }`}
        >
          <Clock className="w-5 h-5 md:w-4 md:h-4" />
          <span className="text-xs md:text-base md:whitespace-nowrap">Várakozás</span>
          {myLobby && <span className="w-2 h-2 bg-warning-500 rounded-full animate-pulse absolute top-1 right-1 md:top-2 md:right-2"></span>}
        </button>
        <button
          onClick={() => setActiveTab('challenges')}
          className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-2 md:px-4 py-2.5 rounded-lg font-medium transition-all relative ${
            activeTab === 'challenges'
              ? 'bg-primary-600 text-white shadow-md'
              : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600'
          }`}
        >
          <Clock className="w-5 h-5 md:w-4 md:h-4" />
          <span className="text-xs md:text-base md:whitespace-nowrap">Aktív Játékaim</span>
          {activeGames.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-error-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {activeGames.length}
            </span>
          )}
        </button>
      </div>

      <ActiveGamesModal />

      {waitingForAcceptance && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <Card className="max-w-md w-full animate-scale-in">
            <div className="text-center py-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-warning-400 to-warning-600 flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              </div>
              <h3 className="text-2xl font-bold text-dark-900 dark:text-white mb-3">
                Várakozás elfogadásra
              </h3>
              <p className="text-dark-600 dark:text-dark-400 mb-2">
                Kihívtál egy játékost az arénában
              </p>
              <p className="text-sm text-dark-500 dark:text-dark-400 mb-6">
                Várakozz, amíg elfogadja a kihívásodat
              </p>

              <div className="inline-flex items-center gap-3 px-6 py-4 rounded-xl bg-warning-100 dark:bg-warning-900/30 mb-6">
                <Clock className="w-6 h-6 text-warning-600 dark:text-warning-400" />
                <span className="text-3xl font-bold text-warning-700 dark:text-warning-400 font-mono">
                  {Math.floor(waitTimeRemaining / 60)}:{(waitTimeRemaining % 60).toString().padStart(2, '0')}
                </span>
              </div>

              <Button
                variant="outline"
                leftIcon={<X className="w-4 h-4" />}
                onClick={() => {
                  setWaitingForAcceptance(false);
                  setMyChallengeId(null);
                }}
                className="w-full"
              >
                Visszavonás
              </Button>
            </div>
          </Card>
        </div>
      )}

      {!waitingForAcceptance && activeTab === 'browse' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-dark-600 dark:text-dark-400">
              {lobbyEntries.length} játékos vár kihívóra
            </p>
            <Button
              leftIcon={<RefreshCw className={`w-4 h-4 ${isManualRefresh ? 'animate-spin' : ''}`} />}
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isManualRefresh}
            >
              {isManualRefresh ? 'Frissítés...' : 'Frissítés'}
            </Button>
          </div>

          {!myLobby && (
            <Card className="border-2 border-primary-500/30 bg-primary-50/50 dark:bg-primary-900/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-dark-900 dark:text-white mb-1">
                    Várakozz kihívóra
                  </h3>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    Állíts be egy játékot és várd meg, hogy mások kihívjanak
                  </p>
                </div>
                <Button
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setShowCreateLobby(true)}
                >
                  Belépés az arénába
                </Button>
              </div>
            </Card>
          )}

          {lobbyEntries.length === 0 && !isLoading && (
            <Card className="text-center py-12">
              <Users className="w-12 h-12 text-dark-400 mx-auto mb-4" />
              <p className="text-dark-600 dark:text-dark-400">
                Jelenleg nincs várakozó játékos
              </p>
              <p className="text-sm text-dark-500 mt-2">
                Lépj be te először az arénába!
              </p>
            </Card>
          )}

          <div className="grid gap-3">
            {lobbyEntries.map((entry) => (
              <Card key={entry.id} className="hover:shadow-lg transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold text-base sm:text-lg shrink-0">
                      {(entry.user_profile?.display_name || entry.user_profile?.username || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-dark-900 dark:text-white text-sm sm:text-base">
                          {entry.user_profile?.display_name || entry.user_profile?.username}
                        </h3>
                        {(() => {
                          const hasPvpAvg = entry.player_stats?.pvp_average && entry.player_stats.pvp_average > 0;
                          const hasLifetimeAvg = entry.player_stats?.lifetime_average && entry.player_stats.lifetime_average > 0;

                          if (hasPvpAvg) {
                            return (
                              <Badge variant="warning" size="sm">
                                <Target className="w-3 h-3 mr-1" />
                                {entry.player_stats.pvp_average!.toFixed(1)} PVP
                              </Badge>
                            );
                          } else if (hasLifetimeAvg) {
                            return (
                              <Badge variant="secondary" size="sm">
                                <Target className="w-3 h-3 mr-1" />
                                {entry.player_stats.lifetime_average!.toFixed(1)} Össz
                              </Badge>
                            );
                          }
                          return null;
                        })()}
                        {entry.player_stats && entry.player_stats.pvp_games_played > 0 && (
                          <Badge variant="default" size="sm">
                            <Trophy className="w-3 h-3 mr-1" />
                            {entry.player_stats.pvp_games_played} PVP
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <Badge variant="default" size="sm">{entry.starting_score}</Badge>
                        <Badge variant="secondary" size="sm">
                          L{entry.legs_to_win} S{entry.sets_to_win}
                        </Badge>
                        {entry.double_out && <Badge variant="success" size="sm">DO</Badge>}
                        {entry.double_in && <Badge variant="warning" size="sm">DI</Badge>}
                        <Badge variant="default" size="sm" className="flex items-center gap-1">
                          {getSkillFilterIcon(entry.skill_filter)}
                          <span className="hidden sm:inline">{getSkillFilterLabel(entry.skill_filter)}</span>
                        </Badge>
                        {lobbyTimeRemaining[entry.id] > 0 && (
                          <Badge variant="warning" size="sm" className="font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimeRemaining(lobbyTimeRemaining[entry.id])}
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-dark-500 dark:text-dark-400">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: hu })}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    leftIcon={<Swords className="w-4 h-4" />}
                    onClick={() => challengePlayer(entry.id)}
                    className="w-full sm:w-auto"
                  >
                    Kihívás
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!waitingForAcceptance && activeTab === 'waiting' && (
        <div className="space-y-4">
          {myLobby ? (
            <>
              <Card className="border-2 border-success-500/30 bg-success-50/50 dark:bg-success-900/10">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-success-100 dark:bg-success-900/30 rounded-lg">
                      <Clock className="w-5 h-5 text-success-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-dark-900 dark:text-white">
                        Várakozol kihívóra
                      </h3>
                      <p className="text-sm text-dark-600 dark:text-dark-400">
                        Más játékosok láthatják a beállításaid és kihívhatnak
                      </p>
                    </div>
                  </div>
                  {timeRemaining > 0 && (
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-dark-500 dark:text-dark-400">Lejár:</span>
                      <span className="text-lg font-bold text-success-600 dark:text-success-400 font-mono">
                        {formatTimeRemaining(timeRemaining)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="default">{myLobby.starting_score}</Badge>
                  <Badge variant="secondary">L{myLobby.legs_to_win} S{myLobby.sets_to_win}</Badge>
                  {myLobby.double_out && <Badge variant="success" size="sm">Double Out</Badge>}
                  {myLobby.double_in && <Badge variant="warning" size="sm">Double In</Badge>}
                  <Badge variant="default" size="sm">
                    {getSkillFilterIcon(myLobby.skill_filter)}
                    <span className="ml-1">{getSkillFilterLabel(myLobby.skill_filter)}</span>
                  </Badge>
                  {(() => {
                    const hasPvpAvg = myLobby.player_stats?.pvp_average && myLobby.player_stats.pvp_average > 0;
                    const hasLifetimeAvg = myLobby.player_stats?.lifetime_average && myLobby.player_stats.lifetime_average > 0;

                    if (hasPvpAvg) {
                      return (
                        <Badge variant="warning" size="sm">
                          <Target className="w-3 h-3 mr-1" />
                          {myLobby.player_stats.pvp_average!.toFixed(1)} PVP
                        </Badge>
                      );
                    } else if (hasLifetimeAvg) {
                      return (
                        <Badge variant="secondary" size="sm">
                          <Target className="w-3 h-3 mr-1" />
                          {myLobby.player_stats.lifetime_average!.toFixed(1)} Össz
                        </Badge>
                      );
                    }
                    return null;
                  })()}
                </div>

                <Button
                  variant="outline"
                  leftIcon={<X className="w-4 h-4" />}
                  onClick={cancelLobby}
                >
                  Kilépés az arénából
                </Button>
              </Card>

              {challenges.length > 0 && (
                <div>
                  <h3 className="font-semibold text-dark-900 dark:text-white mb-3">
                    Beérkezett kihívások ({challenges.length})
                  </h3>
                  <div className="grid gap-3">
                    {challenges.map((challenge) => (
                      <Card key={challenge.id} className="border-l-4 border-l-warning-500">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-warning-500 to-error-500 flex items-center justify-center text-white font-bold shrink-0">
                              {(challenge.challenger?.display_name || challenge.challenger?.username || '?')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-dark-900 dark:text-white truncate">
                                  {challenge.challenger?.display_name || challenge.challenger?.username}
                                </p>
                                {(() => {
                                  const hasPvpAvg = challenge.challenger_stats?.pvp_average && challenge.challenger_stats.pvp_average > 0;
                                  const hasLifetimeAvg = challenge.challenger_stats?.lifetime_average && challenge.challenger_stats.lifetime_average > 0;

                                  if (hasPvpAvg) {
                                    return (
                                      <Badge variant="warning" size="sm">
                                        <Target className="w-3 h-3 mr-1" />
                                        {challenge.challenger_stats.pvp_average!.toFixed(1)} PVP
                                      </Badge>
                                    );
                                  } else if (hasLifetimeAvg) {
                                    return (
                                      <Badge variant="secondary" size="sm">
                                        <Target className="w-3 h-3 mr-1" />
                                        {challenge.challenger_stats.lifetime_average!.toFixed(1)} Össz
                                      </Badge>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-dark-500 dark:text-dark-400">
                                <span>{formatDistanceToNow(new Date(challenge.created_at), { addSuffix: true, locale: hu })}</span>
                                {challengeTimeRemaining[challenge.id] !== undefined && (
                                  <div className="flex items-center gap-1 text-warning-600 dark:text-warning-400 font-medium">
                                    <Clock className="w-3 h-3" />
                                    <span className="font-mono">
                                      {Math.floor(challengeTimeRemaining[challenge.id] / 60)}:{(challengeTimeRemaining[challenge.id] % 60).toString().padStart(2, '0')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="primary"
                              leftIcon={<Check className="w-4 h-4" />}
                              onClick={() => respondToChallenge(challenge.id, true)}
                              className="flex-1 sm:flex-none"
                            >
                              Elfogad
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              leftIcon={<X className="w-4 h-4" />}
                              onClick={() => respondToChallenge(challenge.id, false)}
                              className="flex-1 sm:flex-none"
                            >
                              Elutasít
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <Card className="text-center py-12">
              <Clock className="w-12 h-12 text-dark-400 mx-auto mb-4" />
              <p className="text-dark-600 dark:text-dark-400 mb-4">
                Jelenleg nem várakozol az arénában
              </p>
              <Button
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setShowCreateLobby(true)}
              >
                Belépés az arénába
              </Button>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'challenges' && (
        <div className="space-y-4">
          {activeGames.length === 0 && !isLoading ? (
            <Card className="text-center py-12">
              <Clock className="w-12 h-12 text-dark-400 mx-auto mb-4" />
              <p className="text-dark-600 dark:text-dark-400 mb-2 font-medium">
                Nincs aktív játékod
              </p>
              <p className="text-sm text-dark-500 dark:text-dark-400">
                Kezdj új játékot az Aréna vagy Kihívás tabon
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeGames.map((game: any) => {
                const otherPlayer = game.game_players.find((p: any) => p.user_id !== user?.id);
                const myPlayer = game.game_players.find((p: any) => p.user_id === user?.id);
                const gameAge = Date.now() - new Date(game.updated_at || game.started_at).getTime();
                const hoursOld = gameAge / (1000 * 60 * 60);
                const minutesOld = gameAge / (1000 * 60);

                const otherPlayerName = otherPlayer?.display_name ||
                  otherPlayer?.user_profile?.display_name ||
                  otherPlayer?.user_profile?.username ||
                  'Ellenfél';

                const isDisconnected = game.status === 'paused_disconnect';
                const isPaused = game.status === 'paused_mutual';

                return (
                  <Card
                    key={game.id}
                    className={`border-l-4 ${
                      isDisconnected ? 'border-l-error-500' :
                      isPaused ? 'border-l-warning-500' :
                      'border-l-success-500'
                    } hover:shadow-lg transition-all`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${
                            game.mode === 'pvp'
                              ? 'from-primary-500 to-secondary-500'
                              : 'from-success-500 to-success-600'
                          } flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0`}>
                            {game.mode === 'pvp' ? <Swords className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="font-semibold text-dark-900 dark:text-white truncate">
                                {otherPlayerName}
                              </p>
                              <Badge
                                variant={
                                  game.status === 'in_progress' ? 'success' :
                                  isDisconnected ? 'error' : 'warning'
                                }
                                size="sm"
                              >
                                {game.status === 'in_progress' && 'Folyamatban'}
                                {isDisconnected && 'Lekapcsolódva'}
                                {isPaused && 'Szüneteltetve'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-dark-500 dark:text-dark-400 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {minutesOld < 60
                                  ? `${Math.floor(minutesOld)} perce`
                                  : hoursOld < 24
                                  ? `${Math.floor(hoursOld)} órája`
                                  : `${Math.floor(hoursOld / 24)} napja`}
                              </span>
                              <span>•</span>
                              <span>{game.mode === 'pvp' ? 'PVP Aréna' : 'Baráti kihívás'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 px-3 py-2 bg-dark-50 dark:bg-dark-800 rounded-lg">
                        <div className="flex-1 text-center">
                          <p className="text-2xl font-bold text-dark-900 dark:text-white">
                            {myPlayer?.current_score || 0}
                          </p>
                          <p className="text-xs text-dark-500 dark:text-dark-400">Te</p>
                        </div>
                        <div className="text-dark-400 dark:text-dark-500">VS</div>
                        <div className="flex-1 text-center">
                          <p className="text-2xl font-bold text-dark-900 dark:text-white">
                            {otherPlayer?.current_score || 0}
                          </p>
                          <p className="text-xs text-dark-500 dark:text-dark-400 truncate">
                            {otherPlayerName}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-dark-500 dark:text-dark-400 flex-wrap">
                        <Badge variant="default" size="sm">{game.starting_score}</Badge>
                        <Badge variant="secondary" size="sm">
                          {game.game_type === 'cricket' ? 'Cricket' :
                           game.game_type === 'shanghai' ? 'Shanghai' :
                           game.game_type === 'killer' ? 'Killer' :
                           game.game_type === 'knockout' ? 'Knockout' :
                           game.game_type === 'halve_it' ? 'Halve It' : 'X01'}
                        </Badge>
                        {game.legs_to_win > 1 && (
                          <Badge variant="secondary" size="sm">
                            BO{game.legs_to_win * 2 - 1}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          className="flex-1"
                          onClick={() => navigate(`/game/${game.id}`)}
                        >
                          Folytatás
                        </Button>
                        {isDisconnected && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await supabase
                                .from('push_notifications')
                                .insert({
                                  user_id: otherPlayer.user_id,
                                  type: 'game_reconnect_request',
                                  title: 'Újracsatlakozás kérése',
                                  body: `${myPlayer?.display_name || 'Ellenfeled'} szeretné folytatni a játékot`,
                                  data: { game_id: game.id }
                                });
                            }}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20"
                          onClick={async () => {
                            if (confirm('Biztosan feladod ezt a játékot?')) {
                              await supabase.rpc('surrender_game', { p_game_id: game.id });
                              fetchMyChallenges();
                            }
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showCreateLobby && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <Card className="max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-dark-800 py-2 -mt-2 z-10">
              <CardTitle>Belépés az arénába</CardTitle>
              <button
                onClick={() => setShowCreateLobby(false)}
                className="p-1 text-dark-400 hover:text-dark-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 pb-2">
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Kezdő pontszám
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[301, 501, 701, 1001].map((score) => (
                    <button
                      key={score}
                      onClick={() => setStartingScore(score)}
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
                    Leg-ek
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="11"
                    value={legs}
                    onChange={(e) => setLegs(parseInt(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-dark-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                    Set-ek
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    value={sets}
                    onChange={(e) => setSets(parseInt(e.target.value))}
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
                    onClick={() => setDoubleOut(!doubleOut)}
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
                    onClick={() => setDoubleIn(!doubleIn)}
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
                  Ellenfél szintje
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'any', label: 'Bárki', icon: <Users className="w-3.5 h-3.5" /> },
                    { value: 'similar', label: 'Hasonló', icon: <Minus className="w-3.5 h-3.5" /> },
                    { value: 'higher', label: 'Magasabb', icon: <TrendingUp className="w-3.5 h-3.5" /> },
                    { value: 'lower', label: 'Alacsonyabb', icon: <TrendingDown className="w-3.5 h-3.5" /> },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSkillFilter(option.value)}
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
                  onClick={() => setShowCreateLobby(false)}
                  className="flex-1"
                >
                  Mégse
                </Button>
                <Button
                  variant="primary"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={createLobby}
                  isLoading={isCreating}
                  className="flex-1"
                >
                  Belépés
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
