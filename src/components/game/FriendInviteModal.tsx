import { useState, useEffect } from 'react';
import { X, Search, Send, Users, UserPlus } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

interface FriendInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameSettings: {
    gameType: string;
    startingScore: number;
    legs: number;
    sets: number;
    doubleIn: boolean;
    doubleOut: boolean;
  };
}

interface Player {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  is_friend?: boolean;
}

type ViewMode = 'friends' | 'search';

export function FriendInviteModal({
  isOpen,
  onClose,
  gameSettings,
}: FriendInviteModalProps) {
  const { user } = useAuthStore();
  const [viewMode, setViewMode] = useState<ViewMode>('friends');
  const [friends, setFriends] = useState<Player[]>([]);
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchFriends();
    }
  }, [isOpen]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.length >= 2 && viewMode === 'search') {
        searchUsers();
      } else if (searchQuery.length === 0) {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, viewMode]);

  const fetchFriends = async () => {
    if (!user) return;

    setIsLoading(true);
    const { data } = await supabase
      .from('friendships')
      .select(`
        friend_id,
        user_profile:friend_id (
          id,
          display_name,
          username,
          avatar_url
        )
      `)
      .eq('user_id', user.id);

    if (data) {
      const friendsList = data
        .map((f: any) => ({ ...f.user_profile, is_friend: true }))
        .filter((f: any) => f !== null);
      setFriends(friendsList);
    }
    setIsLoading(false);
  };

  const searchUsers = async () => {
    if (!user || searchQuery.length < 2) return;

    setIsSearching(true);
    const { data, error } = await supabase
      .from('user_profile')
      .select('id, display_name, username, avatar_url')
      .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
      .neq('id', user.id)
      .limit(10);

    if (!error && data) {
      const friendIds = new Set(friends.map((f) => f.id));
      const resultsWithFriendStatus = data.map((u) => ({
        ...u,
        is_friend: friendIds.has(u.id),
      }));
      setSearchResults(resultsWithFriendStatus);
    }
    setIsSearching(false);
  };

  const sendInvite = async (friendId: string) => {
    if (!user) return;

    setSendingTo(friendId);
    try {
      const { data: room, error: roomError } = await supabase
        .from('game_rooms')
        .insert({
          game_type: gameSettings.gameType,
          starting_score: gameSettings.startingScore,
          legs_to_win: gameSettings.legs,
          sets_to_win: gameSettings.sets,
          double_in: gameSettings.doubleIn,
          double_out: gameSettings.doubleOut,
          mode: 'pvp',
          status: 'waiting',
          created_by: user.id,
        })
        .select()
        .single();

      if (roomError) throw roomError;

      await supabase.from('game_players').insert({
        room_id: room.id,
        user_id: user.id,
        is_bot: false,
        player_order: 1,
        current_score: gameSettings.startingScore,
      });

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const { error: inviteError } = await supabase.from('game_invites').insert({
        room_id: room.id,
        inviter_id: user.id,
        invitee_id: friendId,
        status: 'pending',
        expires_at: expiresAt,
      });

      if (inviteError) throw inviteError;

      alert('Meghívó elküldve!');
      onClose();
    } catch (err) {
      console.error('Failed to send invite:', err);
      alert('Hiba történt a meghívó küldése során');
    } finally {
      setSendingTo(null);
    }
  };

  const filteredFriends = friends.filter(
    (f) =>
      viewMode === 'friends' &&
      (f.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.username?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const currentList = viewMode === 'friends' ? filteredFriends : searchResults;
  const loading = viewMode === 'friends' ? isLoading : isSearching;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col animate-scale-in">
        <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
          <div>
            <h2 className="text-xl font-bold text-dark-900 dark:text-white">
              Játékos meghívása
            </h2>
            <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">
              Válassz játékost az online játékhoz
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 border-b border-dark-200 dark:border-dark-700">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              Játék beállítások
            </h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">{gameSettings.startingScore}</Badge>
              <Badge variant="secondary">
                L{gameSettings.legs} S{gameSettings.sets}
              </Badge>
              {gameSettings.doubleOut && (
                <Badge variant="success" size="sm">
                  Double Out
                </Badge>
              )}
              {gameSettings.doubleIn && (
                <Badge variant="warning" size="sm">
                  Double In
                </Badge>
              )}
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setViewMode('friends')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === 'friends'
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400'
              }`}
            >
              <Users className="w-4 h-4" />
              Barátok
            </button>
            <button
              onClick={() => setViewMode('search')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === 'search'
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400'
              }`}
            >
              <Search className="w-4 h-4" />
              Keresés
            </button>
          </div>

          <Input
            placeholder={
              viewMode === 'friends'
                ? 'Barát keresése...'
                : 'Felhasználónév vagy név keresése...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : viewMode === 'friends' && friends.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-dark-400 mx-auto mb-3" />
              <p className="text-dark-600 dark:text-dark-400">
                Még nincs barátod a listában
              </p>
              <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">
                Használd a Keresés fület új játékosok meghívásához
              </p>
            </div>
          ) : viewMode === 'friends' && filteredFriends.length === 0 && searchQuery ? (
            <div className="text-center py-8">
              <p className="text-dark-600 dark:text-dark-400">Nincs találat</p>
            </div>
          ) : viewMode === 'search' && searchQuery.length < 2 ? (
            <div className="text-center py-8">
              <Search className="w-12 h-12 text-dark-400 mx-auto mb-3" />
              <p className="text-dark-600 dark:text-dark-400">
                Írj be legalább 2 karaktert
              </p>
            </div>
          ) : viewMode === 'search' && searchResults.length === 0 && searchQuery.length >= 2 ? (
            <div className="text-center py-8">
              <p className="text-dark-600 dark:text-dark-400">Nincs találat</p>
            </div>
          ) : (
            <div className="space-y-2">
              {currentList.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-dark-50 dark:bg-dark-700/50 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold shrink-0">
                      {(player.display_name || player.username || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-dark-900 dark:text-white truncate">
                          {player.display_name || player.username}
                        </p>
                        {player.is_friend && (
                          <Badge variant="success" size="sm">
                            Barát
                          </Badge>
                        )}
                      </div>
                      {player.username && player.display_name && (
                        <p className="text-xs text-dark-500 truncate">@{player.username}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    leftIcon={<Send className="w-4 h-4" />}
                    onClick={() => sendInvite(player.id)}
                    isLoading={sendingTo === player.id}
                    disabled={sendingTo !== null}
                  >
                    Meghívás
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
