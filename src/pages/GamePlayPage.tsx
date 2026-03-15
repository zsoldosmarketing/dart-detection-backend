import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { t } from '../lib/i18n';
import { Card } from '../components/ui/Card';
import { DartScoreInput } from '../components/game/DartScoreInput';
import { GameHeader } from '../components/game/GameHeader';
import { MessageOverlay } from '../components/game/MessageOverlay';
import { PlayerScoreCards, type PlayerMatchStats } from '../components/game/PlayerScoreCards';
import { CheckoutSuggestions } from '../components/game/CheckoutSuggestions';
import { OpponentCameraFeed } from '../components/game/OpponentCameraFeed';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useConfigStore } from '../stores/configStore';
import { voiceCaller } from '../lib/voiceCaller';
import { voiceRecognition } from '../lib/voiceRecognition';
import { soundEffects } from '../lib/soundEffects';
import {
  getScore,
  getCheckoutRoutes,
  getSetupSuggestions,
  generateBotThrow,
  isBust,
  isCheckout,
  formatDartDisplay,
  BOT_PRESETS,
  type DartTarget,
  type DartThrow,
  type BotParams,
} from '../lib/dartsEngine';
import {
  recordDartThrow,
  recordLegStatistics,
  recordMatchStatistics,
  recordCheckoutAttempt,
  calculateLegStats,
  type StatTrackingContext,
} from '../lib/statisticsTracker';

interface GameRoom {
  id: string;
  starting_score: number;
  legs_to_win: number;
  sets_to_win: number;
  double_out: boolean;
  bot_difficulty: string;
  bot_params: BotParams;
  status: string;
  mode: 'bot' | 'pvp' | 'local';
}

interface Player {
  id: string;
  user_id: string | null;
  is_bot: boolean;
  player_order: number;
  current_score: number;
  legs_won: number;
  sets_won: number;
  bot_difficulty?: string;
  bot_params?: BotParams;
  display_name?: string;
  username?: string;
}

interface GameState {
  current_player_order: number;
  current_leg: number;
  current_set: number;
  darts_thrown_this_turn: number;
  turn_score: number;
  turn_darts: DartTarget[];
}

export function GamePlayPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthStore();
  const { getBackendUrlOverride, setBackendUrlOverride } = useConfigStore();

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTurnDarts, setCurrentTurnDarts] = useState<DartThrow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dartQueue, setDartQueue] = useState<DartTarget[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = localStorage.getItem('soundEnabled');
    return stored === 'true';
  });
  const [voiceRecognitionEnabled, setVoiceRecognitionEnabled] = useState(() => {
    const stored = localStorage.getItem('voiceRecognitionEnabled');
    return stored === 'true';
  });
  const [showSuggestions, setShowSuggestions] = useState(() => {
    const stored = localStorage.getItem('showSuggestions');
    return stored === null ? true : stored === 'true';
  });
  const [showVoiceHelp, setShowVoiceHelp] = useState(false);
  const [legStartTime, setLegStartTime] = useState<Date>(new Date());
  const [matchStartTime] = useState<Date>(new Date());
  const [allLegThrows, setAllLegThrows] = useState<DartThrow[]>([]);
  const [visitNumber, setVisitNumber] = useState(1);
  const [preferredDoubles, setPreferredDoubles] = useState<number[]>([20, 16, 8]);
  const [playerMatchStats, setPlayerMatchStats] = useState<Record<string, PlayerMatchStats>>({});

  useEffect(() => {
    soundEffects.setEnabled(soundEnabled);
    voiceCaller.setEnabled(soundEnabled);
    localStorage.setItem('soundEnabled', soundEnabled.toString());
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('voiceRecognitionEnabled', voiceRecognitionEnabled.toString());
  }, [voiceRecognitionEnabled]);

  useEffect(() => {
    return () => {
      voiceRecognition.stopListening();
      voiceCaller.stop();
      soundEffects.setEnabled(false);
    };
  }, []);


  const currentPlayer = players.find((p) => p.player_order === gameState?.current_player_order);
  const isLocalMode = room?.mode === 'local';
  const isMyTurn = isLocalMode ? !currentPlayer?.is_bot : currentPlayer?.user_id === user?.id;
  const myPlayer = players.find((p) => p.user_id === user?.id);
  const botPlayer = players.find((p) => p.is_bot);

  const getPlayerName = (player: Player) => {
    if (player.is_bot) {
      return player.display_name || `Bot ${player.player_order}`;
    }
    return player.display_name || player.username || `Játékos ${player.player_order}`;
  };


  const toggleSuggestions = () => {
    const newValue = !showSuggestions;
    setShowSuggestions(newValue);
    localStorage.setItem('showSuggestions', newValue.toString());
  };

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
  };

  const toggleVoiceRecognition = () => {
    setVoiceRecognitionEnabled(!voiceRecognitionEnabled);
  };

  useEffect(() => {
    if (roomId) {
      loadGame();
      loadPreferredDoubles();

      const channel = supabase
        .channel(`game-${roomId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` },
          (payload) => {
            console.log('[REALTIME] game_rooms updated:', payload.new);
            setRoom(payload.new as GameRoom);
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'game_state', filter: `room_id=eq.${roomId}` },
          (payload) => {
            console.log('[REALTIME] game_state updated:', payload.new);
            setGameState({
              ...payload.new as any,
              turn_darts: payload.new.turn_darts || [],
            });
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'game_players', filter: `room_id=eq.${roomId}` },
          async (payload) => {
            console.log('[REALTIME] game_players updated:', payload.new);
            const { data } = await supabase
              .from('game_players')
              .select(`
                *,
                user_profile:user_id (display_name, username)
              `)
              .eq('room_id', roomId)
              .order('player_order');

            if (data) {
              const enrichedPlayers = data.map((p: any) => ({
                ...p,
                display_name: p.display_name || p.user_profile?.display_name,
                username: p.user_profile?.username,
              }));
              setPlayers(enrichedPlayers);
            }
          }
        )
        .subscribe((status) => {
          console.log('[REALTIME] Subscription status:', status);
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [roomId, user]);

  const loadPreferredDoubles = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_profile')
      .select('preferred_doubles')
      .eq('id', user.id)
      .maybeSingle();

    if (data?.preferred_doubles) {
      setPreferredDoubles(data.preferred_doubles as unknown as number[]);
    }
  };

  const loadGame = async () => {
    if (!roomId) return;

    const [roomRes, playersRes, stateRes] = await Promise.all([
      supabase.from('game_rooms').select('*').eq('id', roomId).single(),
      supabase.from('game_players').select(`
        *,
        user_profile:user_id (display_name, username)
      `).eq('room_id', roomId).order('player_order'),
      supabase.from('game_state').select('*').eq('room_id', roomId).single(),
    ]);

    if (roomRes.data) setRoom(roomRes.data);
    if (playersRes.data) {
      const enrichedPlayers = playersRes.data.map((p: any) => ({
        ...p,
        display_name: p.display_name || p.user_profile?.display_name,
        username: p.user_profile?.username,
      }));
      setPlayers(enrichedPlayers);
    }
    if (stateRes.data) {
      setGameState({
        ...stateRes.data,
        turn_darts: stateRes.data.turn_darts || [],
      });
    }

    setIsLoading(false);
  };

  const gameStartedRef = useRef(false);
  const gameCompletionHandledRef = useRef(false);

  useEffect(() => {
    const initializeGameAnnouncement = async () => {
      if (room && gameState && players.length > 0 && !gameStartedRef.current && soundEnabled) {
        if (room.status === 'completed' || room.status === 'abandoned' || room.status === 'forfeited') {
          return;
        }

        const { data: turnHistory } = await supabase
          .from('game_turns')
          .select('id')
          .eq('room_id', room.id)
          .limit(1);

        if (turnHistory && turnHistory.length > 0) {
          gameStartedRef.current = true;
          return;
        }

        gameStartedRef.current = true;
        const firstPlayer = players.find(p => p.player_order === gameState.current_player_order);
        if (firstPlayer) {
          const playerName = getPlayerName(firstPlayer);
          setTimeout(() => {
            voiceCaller.callGameOn(playerName);
          }, 500);
        }
      }
    };

    initializeGameAnnouncement();
  }, [room, gameState, players, soundEnabled]);

  useEffect(() => {
    if (room && players.length > 0 && !gameCompletionHandledRef.current) {
      if (room.status === 'completed' || room.status === 'abandoned' || room.status === 'forfeited') {
        gameCompletionHandledRef.current = true;

        const winnerPlayer = players.find(p => p.user_id === room.winner_id);
        if (winnerPlayer) {
          const winnerName = getPlayerName(winnerPlayer);
          const isWinner = winnerPlayer.user_id === user?.id;

          if (soundEnabled && room.status === 'completed') {
            voiceCaller.callGameShot(winnerName);
          }

          setMessage(isWinner ? 'Győzelem!' : `${winnerName} nyert!`);

          setTimeout(() => {
            navigate('/game');
          }, 3000);
        } else if (room.status === 'abandoned') {
          setMessage('A játék megszakadt');
          setTimeout(() => {
            navigate('/game');
          }, 2000);
        }
      } else if (room.status === 'paused_mutual' || room.status === 'paused_disconnect') {
        if (!gameCompletionHandledRef.current) {
          gameCompletionHandledRef.current = true;
          setMessage('Játék szüneteltetve');
          setTimeout(() => {
            navigate('/game');
          }, 2000);
        }
      }
    }
  }, [room?.status, room?.winner_id, players, user, soundEnabled, navigate]);

  const handleCheckout = useCallback(async () => {
    if (!room || !gameState || !currentPlayer) return;

    const newLegsWon = currentPlayer.legs_won + 1;
    const legsNeeded = room.legs_to_win;
    const legDurationSeconds = Math.floor((new Date().getTime() - legStartTime.getTime()) / 1000);
    const checkoutScore = currentTurnDarts.reduce((sum, d) => sum + d.score, 0);

    voiceCaller.callCheckout(checkoutScore);

    if (currentPlayer.user_id) {
      const legStats = calculateLegStats(allLegThrows, room.starting_score, true);
      const checkoutDarts = currentTurnDarts.length;

      const legStatId = await recordLegStatistics({
        playerId: currentPlayer.user_id,
        roomId: room.id,
        setNumber: gameState.current_set,
        legNumber: gameState.current_leg,
        gameType: 'x01',
        startingScore: room.starting_score,
        wasStartingPlayer: currentPlayer.player_order === 1,
        won: true,
        checkoutScore: checkoutScore,
        checkoutDarts: checkoutDarts,
        durationSeconds: legDurationSeconds,
        ...legStats,
      });

      await recordCheckoutAttempt(
        currentPlayer.user_id,
        room.id,
        legStatId,
        checkoutScore,
        true,
        checkoutDarts,
        undefined,
        undefined,
        undefined,
        newLegsWon >= legsNeeded,
        true,
        false,
        players.find(p => p.id !== currentPlayer.id)?.current_score
      );
    }

    const losingPlayer = players.find(p => p.id !== currentPlayer.id);
    if (losingPlayer?.user_id) {
      const loserLegStats = calculateLegStats([], room.starting_score, false);
      await recordLegStatistics({
        playerId: losingPlayer.user_id,
        roomId: room.id,
        setNumber: gameState.current_set,
        legNumber: gameState.current_leg,
        gameType: 'x01',
        startingScore: room.starting_score,
        wasStartingPlayer: losingPlayer.player_order === 1,
        won: false,
        durationSeconds: legDurationSeconds,
        ...loserLegStats,
      });
    }

    await supabase
      .from('game_players')
      .update({ legs_won: newLegsWon, current_score: room.starting_score })
      .eq('id', currentPlayer.id);

    const otherPlayer = players.find((p) => p.id !== currentPlayer.id);
    if (otherPlayer) {
      await supabase
        .from('game_players')
        .update({ current_score: room.starting_score })
        .eq('id', otherPlayer.id);
    }

    if (newLegsWon >= legsNeeded) {
      const matchDurationSeconds = Math.floor((new Date().getTime() - matchStartTime.getTime()) / 1000);

      const { data: allLegStats } = await supabase
        .from('leg_statistics')
        .select('*')
        .eq('room_id', room.id);

      if (currentPlayer.user_id) {
        const playerLegStats = allLegStats?.filter(ls => ls.player_id === currentPlayer.user_id) || [];
        const averages = playerLegStats.map(ls => ls.three_dart_average).filter(a => a > 0);
        const matchAverage = averages.length > 0 ? averages.reduce((sum, a) => sum + a, 0) / averages.length : 0;
        const bestLegAverage = averages.length > 0 ? Math.max(...averages) : 0;
        const worstLegAverage = averages.length > 0 ? Math.min(...averages) : 0;

        const total180s = playerLegStats.reduce((sum, ls) => sum + (ls.visits_180 || 0), 0);
        const total171Plus = playerLegStats.reduce((sum, ls) => sum + ((ls.visits_180 || 0) + (ls.visits_171_179 || 0)), 0);
        const total160Plus = playerLegStats.reduce((sum, ls) => sum + ((ls.visits_180 || 0) + (ls.visits_171_179 || 0) + (ls.visits_160_170 || 0)), 0);
        const total140Plus = playerLegStats.reduce((sum, ls) => sum + ((ls.visits_180 || 0) + (ls.visits_171_179 || 0) + (ls.visits_160_170 || 0) + (ls.visits_140_159 || 0)), 0);
        const total100Plus = playerLegStats.reduce((sum, ls) => sum + (ls.visits_100_plus || 0), 0);
        const totalDoublesHit = playerLegStats.reduce((sum, ls) => sum + (ls.doubles_hit || 0), 0);
        const totalDoublesThrown = playerLegStats.reduce((sum, ls) => sum + (ls.doubles_thrown || 0), 0);
        const totalTriplesHit = playerLegStats.reduce((sum, ls) => sum + (ls.triples_hit || 0), 0);
        const totalTriplesThrown = playerLegStats.reduce((sum, ls) => sum + (ls.triples_thrown || 0), 0);

        const { data: checkoutAttempts } = await supabase
          .from('checkout_attempts')
          .select('*')
          .eq('room_id', room.id)
          .eq('player_id', currentPlayer.user_id);

        const checkoutsHit = checkoutAttempts?.filter(ca => ca.was_successful).length || 0;
        const checkoutAttemptCount = checkoutAttempts?.length || 0;
        const highestCheckout = checkoutAttempts?.filter(ca => ca.was_successful).reduce((max, ca) => Math.max(max, ca.checkout_value || 0), 0) || 0;

        await recordMatchStatistics({
          playerId: currentPlayer.user_id,
          roomId: room.id,
          opponentId: otherPlayer?.user_id || undefined,
          gameType: 'x01',
          gameMode: room.mode,
          startingScore: room.starting_score,
          won: true,
          setsWon: 1,
          setsLost: 0,
          legsWon: newLegsWon,
          legsLost: otherPlayer?.legs_won || 0,
          matchAverage,
          bestLegAverage,
          worstLegAverage,
          total180s,
          total171Plus,
          total160Plus,
          total140Plus,
          total100Plus,
          totalDoublesHit,
          totalDoublesThrown,
          totalTriplesHit,
          totalTriplesThrown,
          checkoutsHit,
          checkoutAttempts: checkoutAttemptCount,
          highestCheckout,
          holds: 0,
          breaks: 0,
          durationSeconds: matchDurationSeconds,
        });
      }

      if (otherPlayer?.user_id) {
        const playerLegStats = allLegStats?.filter(ls => ls.player_id === otherPlayer.user_id) || [];
        const averages = playerLegStats.map(ls => ls.three_dart_average).filter(a => a > 0);
        const matchAverage = averages.length > 0 ? averages.reduce((sum, a) => sum + a, 0) / averages.length : 0;
        const bestLegAverage = averages.length > 0 ? Math.max(...averages) : 0;
        const worstLegAverage = averages.length > 0 ? Math.min(...averages) : 0;

        const total180s = playerLegStats.reduce((sum, ls) => sum + (ls.visits_180 || 0), 0);
        const total171Plus = playerLegStats.reduce((sum, ls) => sum + ((ls.visits_180 || 0) + (ls.visits_171_179 || 0)), 0);
        const total160Plus = playerLegStats.reduce((sum, ls) => sum + ((ls.visits_180 || 0) + (ls.visits_171_179 || 0) + (ls.visits_160_170 || 0)), 0);
        const total140Plus = playerLegStats.reduce((sum, ls) => sum + ((ls.visits_180 || 0) + (ls.visits_171_179 || 0) + (ls.visits_160_170 || 0) + (ls.visits_140_159 || 0)), 0);
        const total100Plus = playerLegStats.reduce((sum, ls) => sum + (ls.visits_100_plus || 0), 0);
        const totalDoublesHit = playerLegStats.reduce((sum, ls) => sum + (ls.doubles_hit || 0), 0);
        const totalDoublesThrown = playerLegStats.reduce((sum, ls) => sum + (ls.doubles_thrown || 0), 0);
        const totalTriplesHit = playerLegStats.reduce((sum, ls) => sum + (ls.triples_hit || 0), 0);
        const totalTriplesThrown = playerLegStats.reduce((sum, ls) => sum + (ls.triples_thrown || 0), 0);

        const { data: checkoutAttempts } = await supabase
          .from('checkout_attempts')
          .select('*')
          .eq('room_id', room.id)
          .eq('player_id', otherPlayer.user_id);

        const checkoutsHit = checkoutAttempts?.filter(ca => ca.was_successful).length || 0;
        const checkoutAttemptCount = checkoutAttempts?.length || 0;
        const highestCheckout = checkoutAttempts?.filter(ca => ca.was_successful).reduce((max, ca) => Math.max(max, ca.checkout_value || 0), 0) || 0;

        await recordMatchStatistics({
          playerId: otherPlayer.user_id,
          roomId: room.id,
          opponentId: currentPlayer.user_id || undefined,
          gameType: 'x01',
          gameMode: room.mode,
          startingScore: room.starting_score,
          won: false,
          setsWon: 0,
          setsLost: 1,
          legsWon: otherPlayer.legs_won,
          legsLost: newLegsWon,
          matchAverage,
          bestLegAverage,
          worstLegAverage,
          total180s,
          total171Plus,
          total160Plus,
          total140Plus,
          total100Plus,
          totalDoublesHit,
          totalDoublesThrown,
          totalTriplesHit,
          totalTriplesThrown,
          checkoutsHit,
          checkoutAttempts: checkoutAttemptCount,
          highestCheckout,
          holds: 0,
          breaks: 0,
          durationSeconds: matchDurationSeconds,
        });
      }

      await supabase
        .from('game_rooms')
        .update({
          status: 'completed',
          winner_id: currentPlayer.user_id,
          completed_at: new Date().toISOString(),
        })
        .eq('id', room.id);

      for (const player of players) {
        if (player.user_id) {
          await supabase.rpc('update_player_statistics_summary', {
            p_player_id: player.user_id,
          });
        }
      }

      return;
    }

    voiceCaller.callLegWon(getPlayerName(currentPlayer), newLegsWon);

    setAllLegThrows([]);
    setVisitNumber(1);
    setLegStartTime(new Date());

    await supabase
      .from('game_state')
      .update({
        current_leg: gameState.current_leg + 1,
        current_player_order: 1,
        darts_thrown_this_turn: 0,
        turn_score: 0,
        turn_darts: [],
      })
      .eq('room_id', room.id);

    setCurrentTurnDarts([]);
    setMessage(null);
    await loadGame();
    setIsProcessing(false);
  }, [room, gameState, currentPlayer, players, currentTurnDarts, allLegThrows, legStartTime, matchStartTime]);

  const handleDartThrow = useCallback(async (target: DartTarget) => {
    if (!room || !gameState || !currentPlayer) return;
    if (!isMyTurn && !currentPlayer.is_bot) return;

    setIsProcessing(true);

    try {
      const score = getScore(target);
      const newTurnDarts = [...currentTurnDarts, { target, score }];
      const newTurnScore = newTurnDarts.reduce((sum, d) => sum + d.score, 0);
      const newRemaining = currentPlayer.current_score - newTurnScore;

      setCurrentTurnDarts(newTurnDarts);
      setAllLegThrows(prev => [...prev, { target, score }]);

      const dartNumber = newTurnDarts.length;
      const remainingBefore = currentPlayer.current_score - (newTurnScore - score);
      const remainingAfter = currentPlayer.current_score - newTurnScore;
      const isCheckoutAttemptFlag = remainingBefore <= 170 && room.double_out;
      const isSuccessfulCheckoutFlag = isCheckout(currentPlayer.current_score, newTurnScore, target);
      const isBustFlag = isBust(currentPlayer.current_score, newTurnScore, target);

      if (currentPlayer.user_id) {
        const otherPlayer = players.find(p => p.id !== currentPlayer.id);
        const context: StatTrackingContext = {
          playerId: currentPlayer.user_id,
          roomId: room.id,
          legNumber: gameState.current_leg,
          setNumber: gameState.current_set,
          visitNumber: visitNumber,
          gameType: 'x01',
          startingScore: room.starting_score,
          isStartingPlayer: currentPlayer.player_order === 1,
          opponentRemaining: otherPlayer?.current_score,
        };

        await recordDartThrow(
          context,
          dartNumber,
          null,
          target,
          score,
          remainingBefore,
          remainingAfter,
          isBustFlag,
          isCheckoutAttemptFlag,
          isSuccessfulCheckoutFlag
        );
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      if (isBustFlag) {
        setMessage('BUST!');
        soundEffects.playBust();
        voiceCaller.callBust();
        return;
      }

      if (isSuccessfulCheckoutFlag) {
        setMessage('CHECKOUT!');
        soundEffects.playCheckout();
        return;
      }
    } finally {
      setIsProcessing(false);
    }
  }, [room, gameState, currentPlayer, currentTurnDarts, isMyTurn, players, visitNumber, allLegThrows]);

  const addToQueue = useCallback((target: DartTarget) => {
    if (currentTurnDarts.length + dartQueue.length >= 3) return;
    soundEffects.playDartImpact();
    setDartQueue(prev => [...prev, target]);
  }, [currentTurnDarts.length, dartQueue.length]);

  useEffect(() => {
    if (dartQueue.length > 0 && !isProcessingQueue && !isProcessing && currentTurnDarts.length < 3 && isMyTurn) {
      setIsProcessingQueue(true);
      const [nextDart, ...rest] = dartQueue;
      setDartQueue(rest);

      handleDartThrow(nextDart).then(() => {
        setTimeout(() => setIsProcessingQueue(false), 200);
      });
    }
  }, [dartQueue, isProcessingQueue, isProcessing, currentTurnDarts.length, handleDartThrow, isMyTurn]);

  const endTurn = async (wasBust: boolean, newScore?: number) => {
    if (!room || !gameState || !currentPlayer) return;

    const finalScore = wasBust ? currentPlayer.current_score : (newScore ?? currentPlayer.current_score);

    if (!wasBust && currentTurnDarts.length > 0) {
      const turnScore = currentTurnDarts.reduce((sum, d) => sum + d.score, 0);
      voiceCaller.callScore(turnScore);
    }

    await supabase
      .from('game_players')
      .update({ current_score: finalScore })
      .eq('id', currentPlayer.id);

    if (!wasBust && currentTurnDarts.length > 0) {
      await supabase.from('game_turns').insert({
        room_id: room.id,
        player_id: currentPlayer.id,
        leg_number: gameState.current_leg,
        set_number: gameState.current_set,
        turn_number: 1,
        darts: currentTurnDarts,
        total_score: currentTurnDarts.reduce((sum, d) => sum + d.score, 0),
        remaining_before: currentPlayer.current_score,
        remaining_after: finalScore,
        is_bust: wasBust,
      });
    }

    const maxPlayerOrder = Math.max(...players.map(p => p.player_order));
    const nextPlayerOrder = gameState.current_player_order >= maxPlayerOrder ? 1 : gameState.current_player_order + 1;
    const nextPlayer = players.find(p => p.player_order === nextPlayerOrder);

    if (nextPlayerOrder === 1) {
      setVisitNumber(prev => prev + 1);
    }

    await supabase
      .from('game_state')
      .update({
        current_player_order: nextPlayerOrder,
        darts_thrown_this_turn: 0,
        turn_score: 0,
        turn_darts: [],
        updated_at: new Date().toISOString(),
      })
      .eq('room_id', room.id);

    if (currentTurnDarts.length > 0 && currentPlayer) {
      const visitScore = wasBust ? 0 : currentTurnDarts.reduce((sum, d) => sum + d.score, 0);
      const dartsCount = currentTurnDarts.length;
      setPlayerMatchStats(prev => {
        const existing = prev[currentPlayer.id] || {
          dartsThrown: 0, totalScore: 0, visits: 0,
          lastVisitScore: 0, highestVisit: 0, first9Darts: [],
        };
        const newFirst9 = existing.first9Darts.length < 9
          ? [...existing.first9Darts, ...currentTurnDarts.map(d => d.score)].slice(0, 9)
          : existing.first9Darts;
        return {
          ...prev,
          [currentPlayer.id]: {
            dartsThrown: existing.dartsThrown + dartsCount,
            totalScore: existing.totalScore + visitScore,
            visits: existing.visits + 1,
            lastVisitScore: visitScore,
            highestVisit: Math.max(existing.highestVisit, visitScore),
            first9Darts: newFirst9,
          },
        };
      });
    }

    setCurrentTurnDarts([]);
    setMessage(null);
    await loadGame();
    setIsProcessing(false);

    if (nextPlayer && soundEnabled) {
      const nextPlayerName = getPlayerName(nextPlayer);
      voiceCaller.callTurnChange(nextPlayerName, nextPlayer.current_score);
    }
  };

  const handleSurrender = async () => {
    if (!room || !roomId || !user) return;

    const confirmSurrender = window.confirm(t('game.surrender_confirm'));
    if (!confirmSurrender) return;

    setIsProcessing(true);
    try {
      const opponent = players.find(p => p.user_id !== user.id);

      const { error } = await supabase
        .from('game_rooms')
        .update({
          status: 'completed',
          winner_id: opponent?.user_id,
          win_type: 'forfeit',
          completed_at: new Date().toISOString(),
        })
        .eq('id', roomId);

      if (error) {
        console.error('Surrender error:', error);
        alert(`${t('game.error_prefix')}: ${error.message}`);
        return;
      }

    } catch (err: any) {
      console.error('Failed to surrender:', err);
      alert(`${t('game.surrender_error')}: ${err?.message || t('error.unknown')}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveAndExit = async () => {
    if (!room || !roomId || !gameState) return;

    const confirmSave = window.confirm(t('game.save_confirm'));
    if (!confirmSave) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('game_rooms')
        .update({
          status: 'paused_mutual',
          paused_at: new Date().toISOString(),
          pause_reason: 'mutual',
        })
        .eq('id', roomId);

      if (error) {
        console.error('Save error:', error);
        alert(`${t('game.error_prefix')}: ${error.message}`);
        setIsProcessing(false);
        return;
      }

    } catch (err: any) {
      console.error('Failed to save game:', err);
      alert(`${t('game.save_error')}: ${err?.message || t('error.unknown')}`);
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (!room || !gameState || !currentPlayer || isProcessing) return;
    if (!currentPlayer.is_bot) return;

    const botDelay = setTimeout(() => {
      playBotTurn();
    }, 1000);

    return () => clearTimeout(botDelay);
  }, [gameState?.current_player_order, isProcessing]);

  const playBotTurn = async () => {
    if (!room || !currentPlayer?.is_bot) return;

    setIsProcessing(true);
    const params = currentPlayer.bot_params ||
      BOT_PRESETS[currentPlayer.bot_difficulty as keyof typeof BOT_PRESETS] ||
      room.bot_params ||
      BOT_PRESETS[room.bot_difficulty as keyof typeof BOT_PRESETS] ||
      BOT_PRESETS.medium;

    let remaining = currentPlayer.current_score;
    const darts: DartThrow[] = [];

    for (let i = 0; i < 3; i++) {
      const isCheckoutAttemptFlag = remaining <= 170;
      const dartThrow = generateBotThrow(remaining, params, isCheckoutAttemptFlag);
      darts.push(dartThrow);

      const turnScore = darts.reduce((sum, d) => sum + d.score, 0);

      setAllLegThrows(prev => [...prev, dartThrow]);

      if (isBust(currentPlayer.current_score, turnScore, dartThrow.target)) {
        setCurrentTurnDarts(darts);
        setMessage(`${getPlayerName(currentPlayer)} BUST!`);
        soundEffects.playDartImpact();
        setTimeout(() => {
          soundEffects.playBust();
          voiceCaller.callBust();
        }, 300);
        setTimeout(() => endTurn(true), 1500);
        return;
      }

      if (isCheckout(currentPlayer.current_score, turnScore, dartThrow.target)) {
        setCurrentTurnDarts(darts);
        setMessage(`${getPlayerName(currentPlayer)} CHECKOUT!`);
        soundEffects.playDartImpact();
        setTimeout(() => {
          soundEffects.playCheckout();
        }, 300);
        setTimeout(() => {
          handleCheckout();
        }, 2000);
        return;
      }

      remaining = currentPlayer.current_score - turnScore;
      setCurrentTurnDarts([...darts]);
      soundEffects.playDartImpact();

      await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400));
    }

    const finalScore = darts.reduce((sum, d) => sum + d.score, 0);
    const newRemaining = currentPlayer.current_score - finalScore;

    voiceCaller.callScore(finalScore);
    setTimeout(() => endTurn(false, newRemaining), 800);
  };

  const handleUndo = async () => {
    if (isProcessing) return;
    if (dartQueue.length > 0) {
      setDartQueue(prev => prev.slice(0, -1));
      return;
    }
    if (currentTurnDarts.length > 0) {
      setCurrentTurnDarts(currentTurnDarts.slice(0, -1));
    }
  };

  const handleSubmitTurn = async () => {
    if (!currentPlayer || !isMyTurn) return;
    if (isProcessing || isProcessingQueue) return;

    const totalDarts = currentTurnDarts.length + dartQueue.length;
    if (totalDarts === 0) return;

    const thrownScore = currentTurnDarts.reduce((s, d) => s + d.score, 0);
    const queuedScore = dartQueue.reduce((s, t) => s + getScore(t), 0);
    const lastDartInTurn = dartQueue.length > 0
      ? dartQueue[dartQueue.length - 1]
      : currentTurnDarts[currentTurnDarts.length - 1]?.target;
    const isCheckoutReached = lastDartInTurn && isCheckout(currentPlayer.current_score, thrownScore + queuedScore, lastDartInTurn);
    const isBustDetected = lastDartInTurn && isBust(currentPlayer.current_score, thrownScore + queuedScore, lastDartInTurn);

    if (totalDarts !== 3 && !isCheckoutReached && !isBustDetected) {
      return;
    }

    if (isBustDetected && dartQueue.length === 0) {
      setIsProcessing(true);
      endTurn(true);
      return;
    }

    if (dartQueue.length > 0) {
      const allDarts = [...currentTurnDarts];
      for (const target of dartQueue) {
        const score = getScore(target);
        allDarts.push({ target, score });
      }
      setCurrentTurnDarts(allDarts);
      setDartQueue([]);

      const newTurnScore = allDarts.reduce((sum, d) => sum + d.score, 0);
      const newRemaining = currentPlayer.current_score - newTurnScore;

      if (isBust(currentPlayer.current_score, newTurnScore, allDarts[allDarts.length - 1]?.target)) {
        setIsProcessing(true);
        endTurn(true);
        return;
      }

      if (isCheckout(currentPlayer.current_score, newTurnScore, allDarts[allDarts.length - 1]?.target)) {
        setIsProcessing(true);
        handleCheckout();
        return;
      }

      setIsProcessing(true);
      setTimeout(() => endTurn(false, newRemaining), 300);
      return;
    }

    const newTurnScore = currentTurnDarts.reduce((sum, d) => sum + d.score, 0);
    const newRemaining = currentPlayer.current_score - newTurnScore;
    const lastDart = currentTurnDarts[currentTurnDarts.length - 1];

    if (isCheckout(currentPlayer.current_score, newTurnScore, lastDart?.target)) {
      setIsProcessing(true);
      handleCheckout();
      return;
    }

    setIsProcessing(true);
    endTurn(false, newRemaining);
  };

  if (isLoading || !room || !gameState) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const queuedScore = dartQueue.reduce((s, t) => s + getScore(t), 0);
  const thrownScore = currentTurnDarts.reduce((s, d) => s + d.score, 0);
  const currentRemaining = currentPlayer ? currentPlayer.current_score - thrownScore - queuedScore : 0;
  const checkoutRoutes = currentPlayer ? getCheckoutRoutes(currentRemaining, preferredDoubles) : [];
  const setupSuggestions = currentPlayer ? getSetupSuggestions(currentRemaining, 3, preferredDoubles) : [];

  const totalDartsInTurn = currentTurnDarts.length + dartQueue.length;
  const lastDartInTurn = dartQueue.length > 0
    ? dartQueue[dartQueue.length - 1]
    : currentTurnDarts[currentTurnDarts.length - 1]?.target;
  const isCheckoutReached = currentPlayer && lastDartInTurn && isCheckout(currentPlayer.current_score, thrownScore + queuedScore, lastDartInTurn);
  const isBustReached = currentPlayer && lastDartInTurn && totalDartsInTurn > 0 && isBust(currentPlayer.current_score, thrownScore + queuedScore, lastDartInTurn);
  const canSubmit = totalDartsInTurn === 3 || !!isCheckoutReached || !!isBustReached;

  const isLocalBackend = getBackendUrlOverride() === 'http://localhost:8000';

  const toggleBackend = () => {
    if (isLocalBackend) {
      setBackendUrlOverride('https://dart-detection-backend-latest.onrender.com');
    } else {
      setBackendUrlOverride('http://localhost:8000');
    }
    window.location.reload();
  };

  return (
    <div className="flex flex-col gap-2 h-[calc(100svh-11rem)] md:h-[calc(100svh-8.5rem)] overflow-hidden animate-fade-in">
      <GameHeader
        mode={room.mode}
        currentLeg={gameState.current_leg}
        startingScore={room.starting_score}
        soundEnabled={soundEnabled}
        isProcessing={isProcessing}
        isAdmin={isAdmin}
        isLocalBackend={isLocalBackend}
        onNavigateBack={() => navigate('/game')}
        onSurrender={handleSurrender}
        onSaveAndExit={handleSaveAndExit}
        onToggleSound={toggleSound}
        onToggleBackend={toggleBackend}
      />

      <MessageOverlay
        message={message}
        showVoiceHelp={showVoiceHelp}
        voiceRecognitionEnabled={voiceRecognitionEnabled}
        onCloseVoiceHelp={() => setShowVoiceHelp(false)}
      />

      <PlayerScoreCards
        players={players}
        gameState={gameState}
        currentPlayerId={currentPlayer?.id}
        currentRemaining={currentRemaining}
        legsToWin={room.legs_to_win}
        getPlayerName={getPlayerName}
        currentTurnDarts={currentTurnDarts}
        isMyTurn={!!isMyTurn}
        playerMatchStats={playerMatchStats}
      />

      <CheckoutSuggestions
        showSuggestions={showSuggestions}
        checkoutRoutes={checkoutRoutes}
        setupSuggestions={setupSuggestions}
        currentRemaining={currentRemaining}
      />

      {isMyTurn && (
        <div className="flex-1 min-h-0 flex flex-col">
        <DartScoreInput
          onThrow={addToQueue}
          onUndo={handleUndo}
          onSubmit={handleSubmitTurn}
          currentDarts={currentTurnDarts}
          queuedDarts={dartQueue}
          thrownScore={thrownScore}
          queuedScore={queuedScore}
          isProcessing={isProcessing}
          canSubmit={canSubmit}
          showSuggestions={showSuggestions}
          onToggleSuggestions={toggleSuggestions}
          suggestions={checkoutRoutes.length > 0
            ? checkoutRoutes.map(route => ({
                route: route.darts.map(d => formatDartDisplay(d)).join(' → '),
                description: route.salvage,
              }))
            : setupSuggestions.map(suggestion => ({
                route: `${formatDartDisplay(suggestion.target)} → ${suggestion.leave}`,
                description: suggestion.projection.slice(0, 2).map((p) => `Ha ${p.hit.startsWith('S') ? p.hit.slice(1) : p.hit}: ${p.leave} marad`).join(' | '),
              }))
          }
          autoStart={isMyTurn}
          voiceEnabled={voiceRecognitionEnabled}
          onToggleVoice={toggleVoiceRecognition}
          soundEnabled={soundEnabled}
        />
        </div>
      )}

      {!isMyTurn && currentPlayer?.is_bot && (
        <Card className="p-3 shrink-0">
          {currentTurnDarts.length > 0 ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-3">
                {[0, 1, 2].map((idx) => {
                  const dart = currentTurnDarts[idx];

                  const formatTarget = (dartThrow: DartThrow) => {
                    const target = dartThrow.target;
                    if (typeof target === 'string') return target;
                    if (target.type === 'miss') return 'Miss';
                    if (target.type === 'double-bull') return 'Bull';
                    if (target.type === 'single-bull') return '25';
                    return `${target.type === 'double' ? 'D' : target.type === 'triple' ? 'T' : 'S'}${target.sector}`;
                  };

                  const displayValue = dart ? formatTarget(dart) : '-';

                  return (
                    <div key={idx} className={`w-14 h-14 rounded-lg flex items-center justify-center text-base font-bold transition-all ${
                      dart ? 'bg-secondary-100 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400'
                      : 'bg-dark-100 dark:bg-dark-700 text-dark-400'
                    }`}>
                      {displayValue}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-dark-400 text-center">
                Bot: {currentTurnDarts.length} / 3 | {currentTurnDarts.reduce((s, d) => s + d.score, 0)} pont
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center py-4">
              <div className="w-8 h-8 border-2 border-secondary-500 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-sm text-dark-500 dark:text-dark-400">Bot gondolkodik...</p>
            </div>
          )}
        </Card>
      )}

      {!isMyTurn && !currentPlayer?.is_bot && room.mode === 'pvp' && roomId && user && (
        <OpponentCameraFeed
          roomId={roomId}
          userId={user.id}
          opponentName={currentPlayer ? getPlayerName(currentPlayer) : 'Ellenfel'}
          isMyTurn={!!isMyTurn}
        />
      )}
    </div>
  );
}
