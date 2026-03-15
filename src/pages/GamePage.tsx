import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Gamepad2,
  Bot,
  Users,
  Monitor,
  ChevronRight,
  ChevronDown,
  Settings,
  Play,
  Minus,
  Plus,
  Clock,
  Trash2,
  Target,
  Skull,
  Zap,
  Search,
  UserPlus,
  X,
  Swords,
} from 'lucide-react';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { PinModal } from '../components/ui/PinModal';
import { DirectChallengeTab } from '../components/pvp/DirectChallengeTab';
import { t } from '../lib/i18n';
import { BOT_PRESETS } from '../lib/dartsEngine';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

type GameMode = 'local' | 'direct_challenge' | 'arena';
type BotDifficulty = 'easy' | 'medium' | 'hard' | 'pro';

interface LocalPlayer {
  id: string | null;
  name: string;
  isRegistered: boolean;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
}

const BOT_STYLES = [
  { id: 'realistic', labelKey: 'bot.style.realistic' },
  { id: 'balanced', labelKey: 'bot.style.balanced' },
  { id: 'competitive', labelKey: 'bot.style.competitive' },
  { id: 'checkout_specialist', labelKey: 'bot.style.checkout_specialist' },
];

interface InProgressGame {
  id: string;
  starting_score: number;
  mode: string;
  bot_difficulty: string | null;
  bot_name?: string;
  created_at: string;
  my_score: number;
  opponent_score: number;
}

export function GamePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [mode, setMode] = useState<GameMode>('local');
  const [startingScore, setStartingScore] = useState(501);
  const [legs, setLegs] = useState(1);
  const [sets, setSets] = useState(1);
  const [matchFormat, setMatchFormat] = useState<'first_to' | 'best_of'>('first_to');
  const [doubleOut, setDoubleOut] = useState(true);
  const [doubleIn, setDoubleIn] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('medium');
  const [botStyle, setBotStyle] = useState('balanced');
  const [botName, setBotName] = useState('Bot');
  const [firstPlayer, setFirstPlayer] = useState<'player' | 'opponent' | 'random'>('random');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [inProgressGames, setInProgressGames] = useState<InProgressGame[]>([]);
  const [isLoadingGames, setIsLoadingGames] = useState(true);
  const [localPlayers, setLocalPlayers] = useState<LocalPlayer[]>([
    { id: null, name: 'Bot', isRegistered: false, isBot: true, botDifficulty: 'medium' }
  ]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showPlayerSearch, setShowPlayerSearch] = useState(false);
  const [pendingPlayer, setPendingPlayer] = useState<{ player: any; index: number } | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchInProgressGames();
    }
  }, [user]);

  const fetchInProgressGames = async () => {
    if (!user) return;
    setIsLoadingGames(true);

    const { data: rooms } = await supabase
      .from('game_rooms')
      .select(`
        id,
        starting_score,
        mode,
        bot_difficulty,
        created_at,
        game_players (
          user_id,
          is_bot,
          current_score,
          display_name
        )
      `)
      .eq('created_by', user.id)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(5);

    if (rooms) {
      const games: InProgressGame[] = rooms.map((room: any) => {
        const myPlayer = room.game_players?.find((p: any) => p.user_id === user.id);
        const opponent = room.game_players?.find((p: any) => p.user_id !== user.id || p.is_bot);
        return {
          id: room.id,
          starting_score: room.starting_score,
          mode: room.mode,
          bot_difficulty: room.bot_difficulty,
          bot_name: opponent?.display_name || (room.mode === 'bot' ? 'Bot' : t('game.opponent')),
          created_at: room.created_at,
          my_score: myPlayer?.current_score ?? room.starting_score,
          opponent_score: opponent?.current_score ?? room.starting_score,
        };
      });
      setInProgressGames(games);
    }

    setIsLoadingGames(false);
  };

  const deleteGame = async (gameId: string) => {
    const { error } = await supabase
      .from('game_rooms')
      .update({ status: 'abandoned' })
      .eq('id', gameId);

    if (!error) {
      setInProgressGames(inProgressGames.filter((g) => g.id !== gameId));
    }
  };

  const searchPlayers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const { data } = await supabase
      .from('user_profile')
      .select('id, username, display_name, avatar_url')
      .neq('id', user?.id || '')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(5);

    if (data) {
      const playersWithPinCheck = await Promise.all(
        data.map(async (player) => {
          const { data: hasPin } = await supabase.rpc('player_has_pin_code', {
            player_id: player.id,
          });
          return { ...player, has_pin_code: hasPin || false };
        })
      );
      setSearchResults(playersWithPinCheck);
    } else {
      setSearchResults([]);
    }

    setIsSearching(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (playerSearch) {
        searchPlayers(playerSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [playerSearch]);

  const selectRegisteredPlayer = (player: any, index: number) => {
    if (!player.has_pin_code) {
      alert(t('player.no_pin_code', { name: player.display_name || player.username }));
      return;
    }
    setPendingPlayer({ player, index });
    setShowPinModal(true);
  };

  const verifyPlayerPin = async (pin: string): Promise<boolean> => {
    if (!pendingPlayer) return false;

    try {
      const { data, error } = await supabase.rpc('verify_player_pin_code', {
        player_id: pendingPlayer.player.id,
        pin: pin,
      });

      if (error) {
        console.error('PIN verification error:', error);
        return false;
      }

      if (data === true) {
        const newPlayers = [...localPlayers];
        newPlayers[pendingPlayer.index] = {
          id: pendingPlayer.player.id,
          name: pendingPlayer.player.display_name || pendingPlayer.player.username,
          isRegistered: true,
          isBot: false,
        };
        setLocalPlayers(newPlayers);
        setShowPlayerSearch(false);
        setPlayerSearch('');
        setSearchResults([]);
        setPendingPlayer(null);
        return true;
      }

      return false;
    } catch (err) {
      console.error('PIN verification failed:', err);
      return false;
    }
  };

  const handlePinModalClose = () => {
    setShowPinModal(false);
    setPendingPlayer(null);
  };

  const clearRegisteredPlayer = (index: number) => {
    const newPlayers = [...localPlayers];
    newPlayers[index] = {
      id: null,
      name: t('game.player_n', { n: index + 2 }),
      isRegistered: false,
      isBot: false,
    };
    setLocalPlayers(newPlayers);
  };

  const addLocalPlayer = () => {
    if (localPlayers.length >= 3) return;
    setLocalPlayers([
      ...localPlayers,
      { id: null, name: t('game.player_n', { n: localPlayers.length + 2 }), isRegistered: false, isBot: false }
    ]);
  };

  const removeLocalPlayer = (index: number) => {
    setLocalPlayers(localPlayers.filter((_, i) => i !== index));
  };

  const togglePlayerBot = (index: number) => {
    const newPlayers = [...localPlayers];
    const player = newPlayers[index];
    if (player.isBot) {
      newPlayers[index] = {
        id: null,
        name: t('game.player_n', { n: index + 2 }),
        isRegistered: false,
        isBot: false,
      };
    } else {
      newPlayers[index] = {
        ...player,
        name: 'Bot',
        isBot: true,
        botDifficulty: 'medium',
        isRegistered: false,
      };
    }
    setLocalPlayers(newPlayers);
  };

  const setPlayerBotDifficulty = (index: number, difficulty: BotDifficulty) => {
    const newPlayers = [...localPlayers];
    newPlayers[index] = { ...newPlayers[index], botDifficulty: difficulty };
    setLocalPlayers(newPlayers);
  };

  const updatePlayerName = (index: number, name: string) => {
    const newPlayers = [...localPlayers];
    newPlayers[index] = { ...newPlayers[index], name };
    setLocalPlayers(newPlayers);
  };

  const handleStartGame = async () => {
    if (!user) {
      alert(t('game.not_logged_in'));
      return;
    }

    setIsStarting(true);

    try {
      const legsToWin = matchFormat === 'best_of' ? Math.ceil(legs / 2) : legs;
      const setsToWin = matchFormat === 'best_of' ? Math.ceil(sets / 2) : sets;

      const { data: room, error } = await supabase
        .from('game_rooms')
        .insert({
          game_type: 'x01',
          starting_score: startingScore,
          legs_to_win: legsToWin,
          sets_to_win: setsToWin,
          double_in: doubleIn,
          double_out: doubleOut,
          mode,
          bot_difficulty: mode === 'bot' ? botDifficulty : null,
          bot_style: mode === 'bot' ? botStyle : null,
          bot_params: mode === 'bot' ? BOT_PRESETS[botDifficulty] : null,
          status: 'in_progress',
          created_by: user.id,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Room creation error:', error);
        alert(t('game.create_error', { msg: error.message }));
        throw error;
      }

      const { error: playerError } = await supabase.from('game_players').insert({
        room_id: room.id,
        user_id: user.id,
        is_bot: false,
        player_order: 1,
        current_score: startingScore,
      });

      if (playerError) {
        console.error('Player insert error:', playerError);
        alert(t('game.player_add_error', { msg: playerError.message }));
        throw playerError;
      }

      if (mode === 'bot') {
        const { error: botError } = await supabase.from('game_players').insert({
          room_id: room.id,
          user_id: null,
          is_bot: true,
          player_order: 2,
          current_score: startingScore,
          display_name: botName,
        });

        if (botError) {
          console.error('Bot insert error:', botError);
          alert(t('game.bot_add_error', { msg: botError.message }));
          throw botError;
        }
      } else if (mode === 'local') {
        for (let i = 0; i < localPlayers.length; i++) {
          const player = localPlayers[i];
          const { error: localPlayerError } = await supabase.from('game_players').insert({
            room_id: room.id,
            user_id: player.isRegistered ? player.id : null,
            is_bot: player.isBot,
            bot_difficulty: player.isBot ? player.botDifficulty : null,
            bot_params: player.isBot && player.botDifficulty ? BOT_PRESETS[player.botDifficulty] : null,
            player_order: i + 2,
            current_score: startingScore,
            display_name: player.name,
          });

          if (localPlayerError) {
            console.error('Local player insert error:', localPlayerError);
            alert(t('game.local_player_add_error', { name: player.name, msg: localPlayerError.message }));
            throw localPlayerError;
          }
        }
      }

      let startingPlayerOrder = 1;
      if (firstPlayer === 'random') {
        const playerCount = mode === 'local' ? localPlayers.length + 1 : 2;
        startingPlayerOrder = Math.floor(Math.random() * playerCount) + 1;
      } else if (firstPlayer === 'opponent') {
        startingPlayerOrder = 2;
      } else if (firstPlayer.startsWith('player_')) {
        startingPlayerOrder = parseInt(firstPlayer.split('_')[1]);
      }

      const { error: stateError } = await supabase.from('game_state').insert({
        room_id: room.id,
        current_player_order: startingPlayerOrder,
        current_leg: 1,
        current_set: 1,
      });

      if (stateError) {
        console.error('Game state insert error:', stateError);
        alert(t('game.state_error', { msg: stateError.message }));
        throw stateError;
      }

      navigate(`/game/${room.id}`);
    } catch (error) {
      console.error('Failed to create game:', error);
      setIsStarting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-dark-900 dark:text-white">{t('nav.games')}</h1>
        <p className="text-dark-500 dark:text-dark-400 mt-1">
          Valassz jatekmódot es inditsd el a meccset
        </p>
      </div>

      {inProgressGames.length > 0 && (
        <Card className="border-2 border-warning-500/30 bg-warning-50/50 dark:bg-warning-900/10">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-warning-600" />
            <span className="font-semibold text-dark-900 dark:text-white">
              Folyamatban levo jatekok ({inProgressGames.length})
            </span>
          </div>
          <div className="overflow-y-auto max-h-[40vh] scroll-list pr-1 space-y-2">
            {inProgressGames.map((game) => {
              const isExpanded = selectedGameId === game.id;
              return (
                <div
                  key={game.id}
                  onClick={() => setSelectedGameId(isExpanded ? null : game.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                    isExpanded
                      ? 'border-warning-500/50 dark:border-warning-500/50 bg-white dark:bg-dark-800 shadow-lg shadow-warning-500/10'
                      : 'bg-white dark:bg-dark-800 border-dark-200/70 dark:border-dark-700/50 hover:shadow-md hover:border-dark-300 dark:hover:border-dark-600/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="text-center">
                        <p className="text-lg font-bold text-primary-600" style={{ fontVariantNumeric: 'tabular-nums' }}>{game.my_score}</p>
                        <p className="text-[10px] text-dark-500">Te</p>
                      </div>
                      <span className="text-dark-400 font-medium">vs</span>
                      <div className="text-center">
                        <p className="text-lg font-bold text-secondary-600" style={{ fontVariantNumeric: 'tabular-nums' }}>{game.opponent_score}</p>
                        <p className="text-[10px] text-dark-500 truncate max-w-[60px]">
                          {game.bot_name || t('game.opponent')}
                        </p>
                      </div>
                      <Badge variant="default" size="sm">{game.starting_score}</Badge>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-dark-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-dark-200/50 dark:border-dark-700/40 animate-in">
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="text-center py-2 px-1 rounded-lg bg-dark-50 dark:bg-dark-700/40">
                          <p className="text-[10px] text-dark-400 uppercase tracking-wider mb-0.5">Mod</p>
                          <p className="text-sm font-bold text-dark-900 dark:text-white capitalize">
                            {game.mode === 'bot' ? t('game.mode_bot') : game.mode === 'pvp' ? t('game.mode_pvp') : t('game.mode_local')}
                          </p>
                        </div>
                        {game.bot_difficulty && (
                          <div className="text-center py-2 px-1 rounded-lg bg-dark-50 dark:bg-dark-700/40">
                            <p className="text-[10px] text-dark-400 uppercase tracking-wider mb-0.5">Bot</p>
                            <p className="text-sm font-bold text-dark-900 dark:text-white capitalize">
                              {t(`bot.${game.bot_difficulty}`)}
                            </p>
                          </div>
                        )}
                        <div className="text-center py-2 px-1 rounded-lg bg-dark-50 dark:bg-dark-700/40">
                          <p className="text-[10px] text-dark-400 uppercase tracking-wider mb-0.5">Kezdes</p>
                          <p className="text-sm font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {new Date(game.created_at).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteGame(game.id)}
                          className="text-error-500 hover:text-error-600 flex-1"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Torles
                        </Button>
                        <Link to={`/game/${game.id}`} className="flex-1">
                          <Button size="sm" leftIcon={<Play className="w-4 h-4" />} className="w-full">
                            Folytatas
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => setMode('local')}
          className={`p-6 rounded-xl border-2 text-left transition-all ${
            mode === 'local'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-dark-200 dark:border-dark-700 hover:border-dark-300 dark:hover:border-dark-600'
          }`}
        >
          <Monitor className={`w-8 h-8 mb-3 ${
            mode === 'local' ? 'text-primary-600' : 'text-dark-500'
          }`} />
          <h3 className={`font-bold text-lg mb-1 ${
            mode === 'local' ? 'text-primary-700 dark:text-primary-400' : 'text-dark-900 dark:text-white'
          }`}>
            {t('game.local')}
          </h3>
          <p className="text-sm text-dark-600 dark:text-dark-400">
            Helyi játék egy eszközön (bot és játékosok ellen)
          </p>
        </button>

        <button
          onClick={() => setMode('direct_challenge')}
          className={`p-6 rounded-xl border-2 text-left transition-all ${
            mode === 'direct_challenge'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-dark-200 dark:border-dark-700 hover:border-dark-300 dark:hover:border-dark-600'
          }`}
        >
          <Users className={`w-8 h-8 mb-3 ${
            mode === 'direct_challenge' ? 'text-primary-600' : 'text-dark-500'
          }`} />
          <h3 className={`font-bold text-lg mb-1 ${
            mode === 'direct_challenge' ? 'text-primary-700 dark:text-primary-400' : 'text-dark-900 dark:text-white'
          }`}>
            {t('game.vs_player')}
          </h3>
          <p className="text-sm text-dark-600 dark:text-dark-400">
            Hívj meg barátokat közvetlen kihívásra
          </p>
        </button>

        <button
          onClick={() => setMode('arena')}
          className={`p-6 rounded-xl border-2 text-left transition-all ${
            mode === 'arena'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-dark-200 dark:border-dark-700 hover:border-dark-300 dark:hover:border-dark-600'
          }`}
        >
          <Swords className={`w-8 h-8 mb-3 ${
            mode === 'arena' ? 'text-primary-600' : 'text-dark-500'
          }`} />
          <h3 className={`font-bold text-lg mb-1 ${
            mode === 'arena' ? 'text-primary-700 dark:text-primary-400' : 'text-dark-900 dark:text-white'
          }`}>
            PVP Aréna
          </h3>
          <p className="text-sm text-dark-600 dark:text-dark-400">
            Találj ellenfelet az arénában
          </p>
        </button>

        <button
          onClick={() => navigate('/party-games')}
          className="p-6 rounded-xl border-2 text-left transition-all border-dark-200 dark:border-dark-700 hover:border-secondary-300 dark:hover:border-secondary-600 hover:bg-secondary-50/50 dark:hover:bg-secondary-900/10"
        >
          <Target className="w-8 h-8 mb-3 text-dark-500" />
          <h3 className="font-bold text-lg mb-1 text-dark-900 dark:text-white">
            Party játékok
          </h3>
          <p className="text-sm text-dark-600 dark:text-dark-400">
            Cricket, Killer, Halve-It és még több
          </p>
        </button>
      </div>

      {mode === 'direct_challenge' ? (
        <DirectChallengeTab />
      ) : mode === 'arena' ? (
        <Card className="text-center py-12">
          <Swords className="w-16 h-16 text-primary-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-dark-900 dark:text-white mb-2">
            PVP Aréna
          </h3>
          <p className="text-dark-600 dark:text-dark-400 mb-6">
            Lépj be az arénába és találj ellenfelet a rangsorban
          </p>
          <Button
            size="lg"
            leftIcon={<Swords className="w-5 h-5" />}
            onClick={() => navigate('/arena')}
          >
            Ugrás az Arénába
          </Button>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>{t('game.settings')}</CardTitle>
          <div className="mt-4 space-y-6">
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-3">
                {t('game.starting_score')}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[301, 501, 701, 1001].map((score) => (
                  <button
                    key={score}
                    onClick={() => setStartingScore(score)}
                    className={`py-3 rounded-lg font-bold transition-all ${
                      startingScore === score
                        ? 'bg-primary-600 text-white'
                        : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600'
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-3">
                Mérkőzés formátum
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMatchFormat('first_to')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    matchFormat === 'first_to'
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600'
                  }`}
                >
                  First to (első X-hez)
                </button>
                <button
                  onClick={() => setMatchFormat('best_of')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    matchFormat === 'best_of'
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600'
                  }`}
                >
                  Best of (legjobb X-ből)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <NumberStepper
                label={matchFormat === 'first_to' ? 'Leg-ek (első X-hez)' : 'Leg-ek (legjobb X-ből)'}
                value={legs}
                onChange={setLegs}
                min={1}
                max={11}
              />
              <NumberStepper
                label={matchFormat === 'first_to' ? 'Set-ek (első X-hez)' : 'Set-ek (legjobb X-ből)'}
                value={sets}
                onChange={setSets}
                min={1}
                max={7}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-dark-700 dark:text-dark-300">
                {t('game.double_out')}
              </span>
              <Toggle checked={doubleOut} onChange={setDoubleOut} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-dark-700 dark:text-dark-300">
                {t('game.double_in')}
              </span>
              <Toggle checked={doubleIn} onChange={setDoubleIn} />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Ki kezdi a játékot?
              </label>
              {mode === 'local' && localPlayers.length >= 1 ? (
                <div className="space-y-2">
                  <button
                    onClick={() => setFirstPlayer('random')}
                    className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      firstPlayer === 'random'
                        ? 'bg-primary-600 text-white'
                        : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600'
                    }`}
                  >
                    🎲 Véletlenszerű
                  </button>
                  <button
                    onClick={() => setFirstPlayer('player')}
                    className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-all text-left flex items-center ${
                      firstPlayer === 'player'
                        ? 'bg-primary-600 text-white'
                        : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600'
                    }`}
                  >
                    <span className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center text-xs font-bold mr-2">1</span>
                    Te
                  </button>
                  {localPlayers.map((player, index) => (
                    <button
                      key={index}
                      onClick={() => setFirstPlayer(`player_${index + 2}` as any)}
                      className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-all text-left flex items-center ${
                        firstPlayer === `player_${index + 2}`
                          ? 'bg-primary-600 text-white'
                          : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600'
                      }`}
                    >
                      <span className="w-6 h-6 rounded-full bg-secondary-500 text-white flex items-center justify-center text-xs font-bold mr-2">{index + 2}</span>
                      {player.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'player', label: 'Te' },
                    { value: 'opponent', label: mode === 'bot' ? 'Bot' : t('game.opponent') },
                    { value: 'random', label: 'Véletlenszerű' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFirstPlayer(option.value as any)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        firstPlayer === option.value
                          ? 'bg-primary-600 text-white'
                          : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        {mode === 'bot' && (
          <Card>
            <CardTitle>{t('bot.difficulty')}</CardTitle>
            <div className="mt-4 space-y-6">
              <div className="grid grid-cols-2 gap-2">
                {(['easy', 'medium', 'hard', 'pro'] as BotDifficulty[]).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setBotDifficulty(diff)}
                    className={`p-3 rounded-lg text-center transition-all ${
                      botDifficulty === diff
                        ? 'bg-primary-600 text-white'
                        : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600'
                    }`}
                  >
                    <span className="font-medium">{t(`bot.${diff}`)}</span>
                    <p className="text-xs mt-1 opacity-75">
                      Atlag: ~{BOT_PRESETS[diff].scoringMean}
                    </p>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Bot neve
                </label>
                <Input
                  type="text"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="Bot"
                  maxLength={20}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-3">
                  {t('bot.style')}
                </label>
                <div className="space-y-2">
                  {BOT_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setBotStyle(style.id)}
                      className={`w-full p-3 rounded-lg text-left transition-all flex items-center justify-between ${
                        botStyle === style.id
                          ? 'bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-500'
                          : 'bg-dark-50 dark:bg-dark-700/50 border-2 border-transparent hover:border-dark-300 dark:hover:border-dark-600'
                      }`}
                    >
                      <span className="font-medium text-dark-900 dark:text-white">
                        {t(style.labelKey)}
                      </span>
                      {botStyle === style.id && (
                        <div className="w-2 h-2 rounded-full bg-primary-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                <Settings className="w-4 h-4" />
                Halado beallitasok
                <ChevronRight className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
              </button>

              {showAdvanced && (
                <div className="p-4 bg-dark-50 dark:bg-dark-700/50 rounded-lg text-sm">
                  <p className="text-dark-500 dark:text-dark-400 mb-3">
                    Bot parameterek: {botDifficulty}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>Scoring Mean: {BOT_PRESETS[botDifficulty].scoringMean}</div>
                    <div>Scoring SD: {BOT_PRESETS[botDifficulty].scoringSd}</div>
                    <div>Triple Hit: {(BOT_PRESETS[botDifficulty].pTripleHit * 100).toFixed(0)}%</div>
                    <div>Double Hit: {(BOT_PRESETS[botDifficulty].pDoubleHit * 100).toFixed(0)}%</div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {mode === 'local' && (
          <Card>
            <CardTitle>Helyi jatekosok</CardTitle>
            <div className="mt-4 space-y-4">
              <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-dark-900 dark:text-white">Te</p>
                    <p className="text-xs text-dark-500">{user?.email}</p>
                  </div>
                </div>
              </div>

              {localPlayers.map((player, index) => (
                <div key={index} className="p-3 rounded-lg bg-dark-50 dark:bg-dark-700/50 border border-dark-200 dark:border-dark-700">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-secondary-500 flex items-center justify-center text-white font-bold">
                      {index + 2}
                    </div>
                    <div className="flex-1">
                      {player.isBot ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 mb-1">
                            <Bot className="w-4 h-4 text-secondary-600" />
                            <p className="text-xs font-medium text-dark-700 dark:text-dark-300">Bot játékos</p>
                          </div>
                          <input
                            type="text"
                            value={player.name}
                            onChange={(e) => updatePlayerName(index, e.target.value)}
                            className="w-full px-3 py-1.5 text-sm rounded-lg border border-dark-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
                            placeholder="Bot neve"
                            maxLength={20}
                          />
                        </div>
                      ) : player.isRegistered ? (
                        <div>
                          <p className="font-medium text-dark-900 dark:text-white">{player.name}</p>
                          <p className="text-xs text-success-600 dark:text-success-400">Regisztralt jatekos</p>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={player.name}
                          onChange={(e) => updatePlayerName(index, e.target.value)}
                          className="w-full px-3 py-1.5 text-sm rounded-lg border border-dark-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
                          placeholder={t('game.player_name_placeholder')}
                        />
                      )}
                    </div>
                    <button
                      onClick={() => removeLocalPlayer(index)}
                      className="p-1 text-dark-400 hover:text-error-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => togglePlayerBot(index)}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                          player.isBot
                            ? 'bg-secondary-500 text-white'
                            : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600'
                        }`}
                      >
                        <Bot className="w-3 h-3 inline mr-1" />
                        Bot
                      </button>
                      <button
                        onClick={() => togglePlayerBot(index)}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                          !player.isBot
                            ? 'bg-primary-500 text-white'
                            : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600'
                        }`}
                      >
                        <Users className="w-3 h-3 inline mr-1" />
                        {t('game.player_label')}
                      </button>
                    </div>

                    {player.isBot ? (
                      <div className="grid grid-cols-2 gap-1">
                        {(['easy', 'medium', 'hard', 'pro'] as BotDifficulty[]).map((diff) => (
                          <button
                            key={diff}
                            onClick={() => setPlayerBotDifficulty(index, diff)}
                            className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                              player.botDifficulty === diff
                                ? 'bg-primary-600 text-white'
                                : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400'
                            }`}
                          >
                            {t(`bot.${diff}`)}
                          </button>
                        ))}
                      </div>
                    ) : !player.isRegistered && (
                      <button
                        onClick={() => setShowPlayerSearch(true)}
                        className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        <UserPlus className="w-3 h-3" />
                        Regisztralt jatekos keresese
                      </button>
                    )}

                    {player.isRegistered && (
                      <button
                        onClick={() => clearRegisteredPlayer(index)}
                        className="w-full py-1.5 text-xs text-dark-500 hover:text-error-500"
                      >
                        Regisztracio torlese
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {localPlayers.length < 3 && (
                <button
                  onClick={addLocalPlayer}
                  className="w-full p-3 rounded-lg border-2 border-dashed border-dark-300 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all flex items-center justify-center gap-2 text-dark-500 hover:text-primary-600"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">{t('game.add_player')}</span>
                </button>
              )}

              {showPlayerSearch && (
                <div className="p-4 rounded-lg bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 space-y-3">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-dark-400" />
                    <input
                      type="text"
                      value={playerSearch}
                      onChange={(e) => setPlayerSearch(e.target.value)}
                      placeholder="Kereses felhasznalonev alapjan..."
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-dark-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        setShowPlayerSearch(false);
                        setPlayerSearch('');
                        setSearchResults([]);
                      }}
                      className="p-2 text-dark-400 hover:text-dark-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {isSearching && (
                    <div className="flex justify-center py-2">
                      <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div className="space-y-1">
                      {searchResults.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => selectRegisteredPlayer(result, 0)}
                          disabled={!result.has_pin_code}
                          className={`w-full p-2 rounded-lg flex items-center gap-3 text-left ${
                            result.has_pin_code
                              ? 'hover:bg-dark-50 dark:hover:bg-dark-700'
                              : 'opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-full bg-dark-200 dark:bg-dark-600 flex items-center justify-center text-xs font-medium">
                            {(result.display_name || result.username || '?')[0].toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-dark-900 dark:text-white text-sm">
                              {result.display_name || result.username}
                            </p>
                            {result.username && result.display_name && (
                              <p className="text-xs text-dark-500">@{result.username}</p>
                            )}
                            {!result.has_pin_code && (
                              <p className="text-xs text-warning-600 dark:text-warning-400">
                                Nincs PIN kód beállítva
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {playerSearch.length >= 2 && !isSearching && searchResults.length === 0 && (
                    <p className="text-sm text-dark-500 text-center py-2">
                      Nincs talalat
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
      )}

      {mode === 'local' && (
        <div className="flex justify-end gap-3">
          <Button
            size="lg"
            leftIcon={<Play className="w-5 h-5" />}
            onClick={handleStartGame}
            isLoading={isStarting}
            disabled={!user}
          >
            {t('game.start')}
          </Button>
        </div>
      )}

      <PinModal
        isOpen={showPinModal}
        onClose={handlePinModalClose}
        onVerify={verifyPlayerPin}
        playerName={pendingPlayer?.player.display_name || pendingPlayer?.player.username || ''}
      />
    </div>
  );
}

interface ModeCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  badge?: string;
  disabled?: boolean;
}

function ModeCard({ icon, title, description, selected, onClick, badge, disabled }: ModeCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-6 rounded-xl border-2 text-left transition-all ${
        disabled
          ? 'opacity-50 cursor-not-allowed border-dark-200 dark:border-dark-700'
          : selected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-dark-200 dark:border-dark-700 hover:border-dark-300 dark:hover:border-dark-600'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${selected ? 'bg-primary-100 dark:bg-primary-800/30 text-primary-600 dark:text-primary-400' : 'bg-dark-100 dark:bg-dark-700 text-dark-500'}`}>
          {icon}
        </div>
        {badge && <Badge variant="warning" size="sm">{badge}</Badge>}
      </div>
      <h3 className="font-semibold text-dark-900 dark:text-white mt-4">{title}</h3>
      <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">{description}</p>
    </button>
  );
}

interface NumberStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}

function NumberStepper({ label, value, onChange, min, max }: NumberStepperProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="p-2 rounded-lg bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600 disabled:opacity-50"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="flex-1 text-center text-lg font-bold text-dark-900 dark:text-white">
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="p-2 rounded-lg bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        checked ? 'bg-primary-600' : 'bg-dark-300 dark:bg-dark-600'
      }`}
    >
      <div
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-7' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
