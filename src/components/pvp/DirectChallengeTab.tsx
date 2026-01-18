import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users, Search, X, Check, Clock, Loader2, Target, Trophy, Minus, Plus } from 'lucide-react';
import { Card, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { formatDistanceToNow } from 'date-fns';
import { hu } from 'date-fns/locale';

interface Friend {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  pvp_average: number | null;
  pvp_games_played: number;
}

interface DirectChallenge {
  id: string;
  challenger_id: string;
  opponent_id: string;
  challenge_type: string;
  game_type: string;
  starting_score: number;
  legs_to_win: number;
  sets_to_win: number;
  match_format: 'first_to' | 'best_of';
  double_in: boolean;
  double_out: boolean;
  status: string;
  created_at: string;
  expires_at: string;
  challenger?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
  opponent?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

export function DirectChallengeTab() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [incomingChallenges, setIncomingChallenges] = useState<DirectChallenge[]>([]);
  const [outgoingChallenges, setOutgoingChallenges] = useState<DirectChallenge[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<Friend | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [waitTimeRemaining, setWaitTimeRemaining] = useState(0);

  const [startingScore, setStartingScore] = useState(501);
  const [legs, setLegs] = useState(1);
  const [sets, setSets] = useState(1);
  const [matchFormat, setMatchFormat] = useState<'first_to' | 'best_of'>('first_to');
  const [doubleOut, setDoubleOut] = useState(true);
  const [doubleIn, setDoubleIn] = useState(false);

  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchDirectChallenges();
      const interval = setInterval(fetchDirectChallenges, 3000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (waitingForResponse) {
      const timer = setInterval(() => {
        setWaitTimeRemaining((prev) => {
          if (prev <= 1) {
            setWaitingForResponse(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [waitingForResponse]);

  const fetchFriends = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('friendships')
      .select(`
        friend_id,
        friend:user_profile!friendships_friend_id_fkey(
          id,
          display_name,
          username,
          avatar_url
        )
      `)
      .eq('user_id', user.id);

    if (data) {
      const friendsList = data.map((f: any) => ({
        id: f.friend.id,
        display_name: f.friend.display_name,
        username: f.friend.username,
        avatar_url: f.friend.avatar_url,
        pvp_average: null,
        pvp_games_played: 0,
      }));
      setFriends(friendsList);
    }
  };

  const fetchDirectChallenges = async () => {
    if (!user) return;

    const { data: incoming } = await supabase
      .from('pvp_challenges')
      .select(`
        *,
        challenger:user_profile!pvp_challenges_challenger_id_fkey(
          display_name,
          username,
          avatar_url
        )
      `)
      .eq('opponent_id', user.id)
      .eq('challenge_type', 'direct')
      .in('status', ['pending'])
      .gt('expires_at', new Date().toISOString());

    const { data: outgoing } = await supabase
      .from('pvp_challenges')
      .select(`
        *,
        opponent:user_profile!pvp_challenges_opponent_id_fkey(
          display_name,
          username,
          avatar_url
        )
      `)
      .eq('challenger_id', user.id)
      .eq('challenge_type', 'direct')
      .in('status', ['pending'])
      .gt('expires_at', new Date().toISOString());

    if (incoming) setIncomingChallenges(incoming);
    if (outgoing) {
      setOutgoingChallenges(outgoing);
      if (outgoing.length > 0 && waitingForResponse) {
        const timeLeft = Math.max(
          0,
          Math.floor((new Date(outgoing[0].expires_at).getTime() - Date.now()) / 1000)
        );
        setWaitTimeRemaining(timeLeft);
      } else if (outgoing.length === 0 && waitingForResponse) {
        setWaitingForResponse(false);
      }
    } else if (waitingForResponse) {
      setWaitingForResponse(false);
    }
  };

  const handleSearchUsername = async () => {
    if (!searchUsername.trim() || !user) return;

    setIsSearching(true);
    try {
      const { data } = await supabase
        .from('user_profile')
        .select('id, display_name, username, avatar_url')
        .ilike('username', `%${searchUsername.trim()}%`)
        .neq('id', user.id)
        .limit(10);

      if (data) {
        setSearchResults(
          data.map((u) => ({
            ...u,
            pvp_average: null,
            pvp_games_played: 0,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to search users:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateChallenge = async (opponentId: string) => {
    if (!user) return;

    setIsCreating(true);
    try {
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);

      const { data: challengeData, error: challengeError } = await supabase
        .from('pvp_challenges')
        .insert({
          challenger_id: user.id,
          opponent_id: opponentId,
          challenge_type: 'direct',
          game_type: 'x01',
          starting_score: startingScore,
          legs_to_win: legs,
          sets_to_win: sets,
          match_format: matchFormat,
          double_in: doubleIn,
          double_out: doubleOut,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (challengeError) throw challengeError;

      const data = { success: true };
      const error = null;

      if (error) throw error;

      if (data.success) {
        setSelectedOpponent(null);
        setShowSettings(false);
        setWaitingForResponse(true);
        setWaitTimeRemaining(300);
        await fetchDirectChallenges();
      } else {
        alert(data.error || 'Failed to create challenge');
      }
    } catch (err) {
      console.error('Failed to create challenge:', err);
      alert('Failed to create challenge');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRespondToChallenge = async (challengeId: string, accept: boolean) => {
    if (!user) return;

    try {
      const challenge = incomingChallenges.find((c) => c.id === challengeId);
      if (!challenge) return;

      if (accept) {
        const { data: room, error: roomError } = await supabase
          .from('game_rooms')
          .insert({
            game_type: challenge.game_type,
            starting_score: challenge.starting_score,
            legs_to_win: challenge.legs_to_win,
            sets_to_win: challenge.sets_to_win,
            match_format: challenge.match_format,
            double_in: challenge.double_in,
            double_out: challenge.double_out,
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
            user_id: challenge.opponent_id,
            is_bot: false,
            player_order: 1,
            current_score: challenge.starting_score,
          },
          {
            room_id: room.id,
            user_id: challenge.challenger_id,
            is_bot: false,
            player_order: 2,
            current_score: challenge.starting_score,
          },
        ]);

        await supabase.from('game_state').insert({
          room_id: room.id,
          current_player_order: Math.random() < 0.5 ? 1 : 2,
          current_leg: 1,
          current_set: 1,
          turn_started_at: new Date().toISOString(),
        });

        await supabase
          .from('pvp_challenges')
          .update({ status: 'accepted', room_id: room.id })
          .eq('id', challengeId);

        navigate(`/game/${room.id}`);
      } else {
        await supabase
          .from('pvp_challenges')
          .update({ status: 'declined' })
          .eq('id', challengeId);

        setIncomingChallenges(incomingChallenges.filter((c) => c.id !== challengeId));
      }
    } catch (err) {
      console.error('Failed to respond to challenge:', err);
      alert('Failed to respond to challenge');
    }
  };

  const handleCancelChallenge = async (challengeId: string) => {
    try {
      await supabase
        .from('pvp_challenges')
        .update({ status: 'cancelled' })
        .eq('id', challengeId);

      setWaitingForResponse(false);
      await fetchDirectChallenges();
    } catch (err) {
      console.error('Failed to cancel challenge:', err);
    }
  };

  const handleSendFriendRequest = async (friendId: string) => {
    if (!user) return;

    try {
      const { data: existingRequest } = await supabase
        .from('friend_requests')
        .select('id, status')
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${friendId}),and(from_user_id.eq.${friendId},to_user_id.eq.${user.id})`)
        .maybeSingle();

      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          alert('Már küldtél barátfelkérést ennek a játékosnak vagy ő küldött neked!');
        } else if (existingRequest.status === 'accepted') {
          alert('Már barátok vagytok!');
        }
        return;
      }

      const { data: existingFriendship } = await supabase
        .from('friendships')
        .select('id')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`)
        .maybeSingle();

      if (existingFriendship) {
        alert('Már barátok vagytok!');
        return;
      }

      const { error: requestError } = await supabase
        .from('friend_requests')
        .insert({
          from_user_id: user.id,
          to_user_id: friendId,
          status: 'pending',
        });

      if (requestError) throw requestError;

      await supabase.from('push_notifications').insert({
        user_id: friendId,
        type: 'friend_request',
        title: 'Új barátfelkérés',
        body: 'Valaki barátnak jelölt téged!',
        data: { from_user_id: user.id },
      });

      alert('Barátfelkérés elküldve!');
      setSearchResults([]);
      setSearchUsername('');
    } catch (err) {
      console.error('Failed to send friend request:', err);
      alert('Nem sikerült elküldeni a barátfelkérést');
    }
  };

  return (
    <>
      {waitingForResponse && outgoingChallenges.length > 0 && (
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
                Kihívtad{' '}
                <span className="font-semibold text-dark-900 dark:text-white">
                  {outgoingChallenges[0].opponent?.display_name || 'az ellenfelet'}
                </span>
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

              <div className="bg-dark-50 dark:bg-dark-700/50 rounded-lg p-4 mb-6">
                <div className="text-sm text-dark-600 dark:text-dark-400 space-y-2">
                  <div className="flex justify-between">
                    <span>Játék típus:</span>
                    <span className="font-semibold text-dark-900 dark:text-white">
                      {outgoingChallenges[0].starting_score}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Formátum:</span>
                    <span className="font-semibold text-dark-900 dark:text-white">
                      {outgoingChallenges[0].match_format === 'first_to' ? 'First to' : 'Best of'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Leg-ek / Set-ek:</span>
                    <span className="font-semibold text-dark-900 dark:text-white">
                      {outgoingChallenges[0].legs_to_win} / {outgoingChallenges[0].sets_to_win}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                leftIcon={<X className="w-4 h-4" />}
                onClick={() => handleCancelChallenge(outgoingChallenges[0].id)}
                className="w-full"
              >
                Visszavonás
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="space-y-6">
      {!waitingForResponse && (
        <>
          {incomingChallenges.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-dark-700 dark:text-dark-300">
                Bejövő kihívások
              </h3>
              {incomingChallenges.map((challenge) => (
                <Card
                  key={challenge.id}
                  className="border-2 border-primary-500/30 bg-primary-50/50 dark:bg-primary-900/10"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {challenge.challenger?.avatar_url ? (
                        <img
                          src={challenge.challenger.avatar_url}
                          alt=""
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold">
                          {challenge.challenger?.display_name?.[0] || '?'}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-dark-900 dark:text-white">
                          {challenge.challenger?.display_name || 'Unknown'}
                        </div>
                        <div className="text-sm text-dark-600 dark:text-dark-400">
                          {challenge.starting_score} ·
                          {challenge.match_format === 'first_to' ? ' First to ' : ' Best of '}
                          {challenge.legs_to_win} leg{challenge.legs_to_win > 1 ? 's' : ''} ·
                          {challenge.sets_to_win} set{challenge.sets_to_win > 1 ? 's' : ''}
                        </div>
                        <div className="text-xs text-dark-500 mt-1">
                          {formatDistanceToNow(new Date(challenge.created_at), {
                            addSuffix: true,
                            locale: hu,
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        leftIcon={<Check className="w-4 h-4" />}
                        onClick={() => handleRespondToChallenge(challenge.id, true)}
                      >
                        Elfogadom
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<X className="w-4 h-4" />}
                        onClick={() => handleRespondToChallenge(challenge.id, false)}
                      >
                        Elutasítom
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <Card className="border-2 border-primary-500/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="mb-1">Közvetlen Kihívás</CardTitle>
                <p className="text-sm text-dark-600 dark:text-dark-400">
                  Hívd ki barátaidat vagy keress meg játékosokat
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-primary-600" />
                  <label className="text-sm font-semibold text-dark-700 dark:text-dark-300">
                    Barátaid
                  </label>
                </div>
                {friends.length === 0 ? (
                  <div className="text-center py-8 bg-dark-50 dark:bg-dark-800/50 rounded-lg border-2 border-dashed border-dark-200 dark:border-dark-700">
                    <Users className="w-10 h-10 text-dark-400 mx-auto mb-3" />
                    <p className="text-sm text-dark-600 dark:text-dark-400 mb-1">
                      Még nincs barátod
                    </p>
                    <p className="text-xs text-dark-500">
                      Keress felhasználókat lent!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {friends.map((friend) => (
                      <button
                        key={friend.id}
                        onClick={() => {
                          setSelectedOpponent(friend);
                          setShowSettings(true);
                        }}
                        className="flex items-center gap-3 p-3 rounded-lg border-2 border-dark-200 dark:border-dark-600 hover:border-primary-500 hover:bg-gradient-to-br hover:from-primary-50 hover:to-primary-100/50 dark:hover:from-primary-900/20 dark:hover:to-primary-900/10 transition-all hover:shadow-md"
                      >
                        {friend.avatar_url ? (
                          <img
                            src={friend.avatar_url}
                            alt=""
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-white dark:ring-dark-800"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold text-lg ring-2 ring-white dark:ring-dark-800">
                            {friend.display_name[0]}
                          </div>
                        )}
                        <div className="text-left flex-1 min-w-0">
                          <div className="font-semibold text-dark-900 dark:text-white truncate">
                            {friend.display_name}
                          </div>
                          <div className="text-xs text-dark-500 truncate">@{friend.username}</div>
                        </div>
                        <Trophy className="w-4 h-4 text-primary-600 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-dark-200 dark:border-dark-700 pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <Search className="w-4 h-4 text-primary-600" />
                  <label className="text-sm font-semibold text-dark-700 dark:text-dark-300">
                    Keresés felhasználónév alapján
                  </label>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={searchUsername}
                    onChange={(e) => setSearchUsername(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchUsername()}
                    placeholder="írj be egy felhasználónevet..."
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSearchUsername}
                    disabled={isSearching || !searchUsername.trim()}
                    leftIcon={isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  >
                    {isSearching ? 'Keresés...' : 'Keresés'}
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-dark-500 dark:text-dark-400 mb-2">
                      {searchResults.length} találat
                    </p>
                    {searchResults.map((result) => (
                      <div
                        key={result.id}
                        className="flex items-center gap-2 p-3 rounded-lg border-2 border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-800"
                      >
                        {result.avatar_url ? (
                          <img
                            src={result.avatar_url}
                            alt=""
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-white dark:ring-dark-800"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-success-500 to-success-600 flex items-center justify-center text-white font-bold text-lg ring-2 ring-white dark:ring-dark-800">
                            {result.display_name[0]}
                          </div>
                        )}
                        <div className="text-left flex-1 min-w-0">
                          <div className="font-semibold text-dark-900 dark:text-white truncate">
                            {result.display_name}
                          </div>
                          <div className="text-xs text-dark-500 truncate">@{result.username}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSendFriendRequest(result.id)}
                            className="p-2 rounded-lg bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 hover:bg-success-200 dark:hover:bg-success-900/50 transition-colors"
                            title="Barát jelölés"
                          >
                            <UserPlus className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedOpponent(result);
                              setShowSettings(true);
                              setSearchResults([]);
                              setSearchUsername('');
                            }}
                            className="px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
                          >
                            Kihívás
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {showSettings && selectedOpponent && (
            <Card className="border-2 border-secondary-500 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary-500 to-error-500 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <CardTitle>Játék Beállítások</CardTitle>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                >
                  <X className="w-5 h-5 text-dark-500" />
                </button>
              </div>

              <div className="space-y-5">
                <div className="p-4 bg-gradient-to-br from-secondary-50 to-secondary-100/50 dark:from-secondary-900/20 dark:to-secondary-900/10 rounded-xl border-2 border-secondary-200 dark:border-secondary-800">
                  <div className="flex items-center gap-3">
                    {selectedOpponent.avatar_url ? (
                      <img
                        src={selectedOpponent.avatar_url}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-white dark:ring-dark-800"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-secondary-500 to-error-500 flex items-center justify-center text-white font-bold text-lg ring-2 ring-white dark:ring-dark-800">
                        {selectedOpponent.display_name[0]}
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-dark-500 dark:text-dark-400">Kihívod</p>
                      <p className="font-bold text-dark-900 dark:text-white text-lg">
                        {selectedOpponent.display_name}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-3">
                    Kezdő pontszám
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[301, 501, 701, 1001].map((score) => (
                      <button
                        key={score}
                        onClick={() => setStartingScore(score)}
                        className={`py-3 rounded-lg font-bold transition-all ${
                          startingScore === score
                            ? 'bg-primary-600 text-white shadow-lg'
                            : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600'
                        }`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-3">
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

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-dark-700 dark:text-dark-300">
                      Double Out
                    </span>
                    <Toggle checked={doubleOut} onChange={setDoubleOut} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-dark-700 dark:text-dark-300">
                      Double In
                    </span>
                    <Toggle checked={doubleIn} onChange={setDoubleIn} />
                  </div>
                </div>

                <Button
                  onClick={() => handleCreateChallenge(selectedOpponent.id)}
                  disabled={isCreating}
                  className="w-full"
                  size="lg"
                  leftIcon={isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trophy className="w-5 h-5" />}
                >
                  {isCreating ? 'Kihívás Küldése...' : 'Kihívás Küldése'}
                </Button>
              </div>
            </Card>
          )}
        </>
      )}
      </div>
    </>
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
