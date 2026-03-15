import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../lib/i18n';
import {
  Swords,
  Filter,
  Clock,
  Users,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { ActiveGamesModal } from '../components/pvp/ActiveGamesModal';
import { LobbyBrowser } from '../components/pvp/LobbyBrowser';
import { LobbyWaiting } from '../components/pvp/LobbyWaiting';
import { ActiveGamesList } from '../components/pvp/ActiveGamesList';
import { CreateLobbyModal } from '../components/pvp/CreateLobbyModal';

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
  status?: string;
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

      setMyLobby(lobbyWithStats);
    } else if (!myLobby || myLobby.status !== 'waiting') {
      setMyLobby(null);
    } else {
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

      setMyLobby(data);
      setShowCreateLobby(false);

      await new Promise(resolve => setTimeout(resolve, 100));

      setActiveTab('waiting');
    } catch (err: any) {
      console.error('Failed to create lobby:', err);
      alert(t('game.lobby_create_error', { msg: err.message || t('error.unknown') }));
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

    try {
      const lobbyEntry = lobbyEntries.find((e) => e.id === lobbyId);

      if (!lobbyEntry || !lobbyEntry.user_id) {
        alert(t('game.lobby_not_found'));
        return;
      }

      if (lobbyEntry.user_id === user.id) {
        alert(t('game.self_challenge'));
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
        throw error;
      }

      setMyChallengeId(data.id);
      setWaitingForAcceptance(true);
      setWaitTimeRemaining(120);
    } catch (err: any) {
      alert(t('game.send_challenge_error', { msg: err?.message || t('error.unknown') }));
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
        return t('pvp.skill_similar');
      case 'higher':
        return t('pvp.skill_higher');
      case 'lower':
        return t('pvp.skill_lower');
      default:
        return t('pvp.skill_any');
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
          {t('pvp.arena_title')}
        </h1>
        <p className="text-dark-500 dark:text-dark-400 mt-1">
          {t('pvp.arena_subtitle')}
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
          <span className="text-xs md:text-base md:whitespace-nowrap">{t('pvp.tab_players')}</span>
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
          <span className="text-xs md:text-base md:whitespace-nowrap">{t('pvp.tab_waiting')}</span>
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
          <span className="text-xs md:text-base md:whitespace-nowrap">{t('pvp.tab_active')}</span>
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
                {t('pvp.waiting_acceptance')}
              </h3>
              <p className="text-dark-600 dark:text-dark-400 mb-2">
                {t('pvp.challenged_player')}
              </p>
              <p className="text-sm text-dark-500 dark:text-dark-400 mb-6">
                {t('pvp.wait_accept')}
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
                {t('pvp.withdraw')}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {!waitingForAcceptance && activeTab === 'browse' && (
        <LobbyBrowser
          lobbyEntries={lobbyEntries}
          isLoading={isLoading}
          isManualRefresh={isManualRefresh}
          myLobby={myLobby}
          lobbyTimeRemaining={lobbyTimeRemaining}
          onManualRefresh={handleManualRefresh}
          onShowCreateLobby={() => setShowCreateLobby(true)}
          onChallengePlayer={challengePlayer}
          getSkillFilterLabel={getSkillFilterLabel}
          getSkillFilterIcon={getSkillFilterIcon}
          formatTimeRemaining={formatTimeRemaining}
        />
      )}

      {!waitingForAcceptance && activeTab === 'waiting' && (
        <LobbyWaiting
          myLobby={myLobby}
          challenges={challenges}
          timeRemaining={timeRemaining}
          challengeTimeRemaining={challengeTimeRemaining}
          onCancelLobby={cancelLobby}
          onShowCreateLobby={() => setShowCreateLobby(true)}
          onRespondToChallenge={respondToChallenge}
          getSkillFilterLabel={getSkillFilterLabel}
          getSkillFilterIcon={getSkillFilterIcon}
          formatTimeRemaining={formatTimeRemaining}
        />
      )}

      {activeTab === 'challenges' && (
        <ActiveGamesList
          activeGames={activeGames}
          isLoading={isLoading}
          userId={user?.id}
          onNavigate={navigate}
          onRefreshGames={fetchMyChallenges}
        />
      )}

      {showCreateLobby && (
        <CreateLobbyModal
          startingScore={startingScore}
          legs={legs}
          sets={sets}
          doubleOut={doubleOut}
          doubleIn={doubleIn}
          skillFilter={skillFilter}
          isCreating={isCreating}
          onStartingScoreChange={setStartingScore}
          onLegsChange={setLegs}
          onSetsChange={setSets}
          onDoubleOutChange={setDoubleOut}
          onDoubleInChange={setDoubleIn}
          onSkillFilterChange={setSkillFilter}
          onCreateLobby={createLobby}
          onClose={() => setShowCreateLobby(false)}
        />
      )}
    </div>
  );
}
