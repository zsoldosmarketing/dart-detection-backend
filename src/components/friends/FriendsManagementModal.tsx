import { useState, useEffect } from 'react';
import {
  X,
  Users,
  UserPlus,
  UserMinus,
  UserX,
  Check,
  Ban,
  Search,
  Loader2,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  created_at: string;
  from_user?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
  to_user?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

interface Friend {
  id: string;
  friend_id: string;
  friend?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

interface BlockedUser {
  id: string;
  blocked_user_id: string;
  reason: string | null;
  blocked_user?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

interface UserSearchResult {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  friend_status?: {
    is_friend: boolean;
    has_pending_request: boolean;
    sent_request: boolean;
    is_blocked: boolean;
    is_blocking: boolean;
  };
}

interface Props {
  onClose: () => void;
}

type Tab = 'friends' | 'requests' | 'blocked' | 'search';

export function FriendsManagementModal({ onClose }: Props) {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, activeTab]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.length >= 2 && activeTab === 'search') {
        searchUsers();
      } else if (searchQuery.length === 0) {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    if (activeTab === 'friends') {
      await fetchFriends();
    } else if (activeTab === 'requests') {
      await fetchFriendRequests();
    } else if (activeTab === 'blocked') {
      await fetchBlockedUsers();
    }
    setIsLoading(false);
  };

  const fetchFriends = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        friend_id,
        friend:user_profile!friendships_friend_id_fkey(display_name, username, avatar_url)
      `)
      .eq('user_id', user.id);

    if (!error && data) {
      setFriends(data);
    }
  };

  const fetchFriendRequests = async () => {
    if (!user) return;

    const { data: received, error: receivedError } = await supabase
      .from('friend_requests')
      .select(`
        id,
        from_user_id,
        to_user_id,
        status,
        created_at,
        from_user:user_profile!friend_requests_from_user_id_fkey(display_name, username, avatar_url)
      `)
      .eq('to_user_id', user.id)
      .eq('status', 'pending');

    const { data: sent, error: sentError } = await supabase
      .from('friend_requests')
      .select(`
        id,
        from_user_id,
        to_user_id,
        status,
        created_at,
        to_user:user_profile!friend_requests_to_user_id_fkey(display_name, username, avatar_url)
      `)
      .eq('from_user_id', user.id)
      .eq('status', 'pending');

    if (!receivedError && received) setFriendRequests(received);
    if (!sentError && sent) setSentRequests(sent);
  };

  const fetchBlockedUsers = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('blocked_users')
      .select(`
        id,
        blocked_user_id,
        reason,
        blocked_user:user_profile!blocked_users_blocked_user_id_fkey(display_name, username, avatar_url)
      `)
      .eq('user_id', user.id);

    if (!error && data) {
      setBlockedUsers(data);
    }
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
      const resultsWithStatus = await Promise.all(
        data.map(async (u) => {
          const { data: status } = await supabase.rpc('get_friend_status', {
            other_user_id: u.id,
          });
          return { ...u, friend_status: status };
        })
      );
      setSearchResults(resultsWithStatus);
    }
    setIsSearching(false);
  };

  const sendFriendRequest = async (toUserId: string) => {
    if (!user) return;

    const { data: requestData, error } = await supabase.from('friend_requests').insert({
      from_user_id: user.id,
      to_user_id: toUserId,
      status: 'pending',
    }).select().single();

    if (!error && requestData) {
      const { data: senderProfile } = await supabase
        .from('user_profile')
        .select('display_name, username')
        .eq('id', user.id)
        .single();

      const senderName = senderProfile?.display_name || senderProfile?.username || 'Valaki';

      await supabase.from('notification_receipts').insert({
        user_id: toUserId,
        title: 'Új barát kérés',
        body: `${senderName} barátnak jelölt téged!`,
        category: 'system',
        action_url: '/profile',
        is_read: false,
      });

      searchUsers();
    }
  };

  const acceptFriendRequest = async (requestId: string) => {
    const { error } = await supabase.rpc('accept_friend_request', {
      request_id: requestId,
    });

    if (!error) {
      fetchFriendRequests();
    }
  };

  const rejectFriendRequest = async (requestId: string) => {
    const { error } = await supabase.rpc('reject_friend_request', {
      request_id: requestId,
    });

    if (!error) {
      fetchFriendRequests();
    }
  };

  const removeFriend = async (friendId: string) => {
    const { error } = await supabase.rpc('remove_friend', {
      friend_user_id: friendId,
    });

    if (!error) {
      fetchFriends();
    }
  };

  const blockUser = async (userId: string) => {
    const { error } = await supabase.rpc('block_user', {
      blocked_user_id: userId,
      block_reason: null,
    });

    if (!error) {
      fetchFriends();
      fetchBlockedUsers();
      searchUsers();
    }
  };

  const unblockUser = async (userId: string) => {
    const { error } = await supabase.rpc('unblock_user', {
      blocked_user_id: userId,
    });

    if (!error) {
      fetchBlockedUsers();
    }
  };

  const cancelFriendRequest = async (requestId: string) => {
    const { error } = await supabase.from('friend_requests').delete().eq('id', requestId);

    if (!error) {
      fetchFriendRequests();
    }
  };

  const pendingRequestsCount = friendRequests.length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
        <div className="flex items-center justify-between p-4 border-b border-dark-200 dark:border-dark-700">
          <h2 className="text-xl font-bold text-dark-900 dark:text-white">Barátok kezelése</h2>
          <button
            onClick={onClose}
            className="p-1 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 p-4 border-b border-dark-200 dark:border-dark-700 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'friends'
                ? 'bg-primary-600 text-white'
                : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400'
            }`}
          >
            <Users className="w-4 h-4" />
            Barátok
            {friends.length > 0 && (
              <Badge variant="secondary" size="sm">
                {friends.length}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap relative ${
              activeTab === 'requests'
                ? 'bg-primary-600 text-white'
                : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Kérések
            {pendingRequestsCount > 0 && (
              <Badge variant="warning" size="sm">
                {pendingRequestsCount}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'search'
                ? 'bg-primary-600 text-white'
                : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400'
            }`}
          >
            <Search className="w-4 h-4" />
            Keresés
          </button>
          <button
            onClick={() => setActiveTab('blocked')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'blocked'
                ? 'bg-primary-600 text-white'
                : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400'
            }`}
          >
            <Ban className="w-4 h-4" />
            Tiltva
            {blockedUsers.length > 0 && (
              <Badge variant="error" size="sm">
                {blockedUsers.length}
              </Badge>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'search' && (
            <div className="mb-4">
              <Input
                placeholder="Keress felhasználónév vagy név alapján..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
          )}

          {isLoading || isSearching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {activeTab === 'friends' && friends.map((friend) => (
                <Card key={friend.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold">
                        {(friend.friend?.display_name || friend.friend?.username || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-dark-900 dark:text-white">
                          {friend.friend?.display_name || friend.friend?.username}
                        </p>
                        {friend.friend?.display_name && (
                          <p className="text-sm text-dark-500">@{friend.friend.username}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<UserMinus className="w-4 h-4" />}
                        onClick={() => removeFriend(friend.friend_id)}
                      >
                        Eltávolítás
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<Ban className="w-4 h-4" />}
                        onClick={() => blockUser(friend.friend_id)}
                      >
                        Tiltás
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}

              {activeTab === 'requests' && (
                <>
                  {friendRequests.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-dark-700 dark:text-dark-300 mb-2">
                        Beérkező kérések
                      </h3>
                      {friendRequests.map((request) => (
                        <Card key={request.id} className="p-4 mb-3 border-l-4 border-l-primary-500">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold">
                                {(request.from_user?.display_name || request.from_user?.username || '?')[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-dark-900 dark:text-white">
                                  {request.from_user?.display_name || request.from_user?.username}
                                </p>
                                {request.from_user?.display_name && (
                                  <p className="text-sm text-dark-500">@{request.from_user.username}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="primary"
                                leftIcon={<Check className="w-4 h-4" />}
                                onClick={() => acceptFriendRequest(request.id)}
                              >
                                Elfogad
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                leftIcon={<X className="w-4 h-4" />}
                                onClick={() => rejectFriendRequest(request.id)}
                              >
                                Elutasít
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}

                  {sentRequests.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-dark-700 dark:text-dark-300 mb-2">
                        Elküldött kérések
                      </h3>
                      {sentRequests.map((request) => (
                        <Card key={request.id} className="p-4 mb-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-dark-300 to-dark-400 flex items-center justify-center text-white font-bold">
                                {(request.to_user?.display_name || request.to_user?.username || '?')[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-dark-900 dark:text-white">
                                  {request.to_user?.display_name || request.to_user?.username}
                                </p>
                                <p className="text-xs text-dark-500">Várakozik...</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              leftIcon={<X className="w-4 h-4" />}
                              onClick={() => cancelFriendRequest(request.id)}
                            >
                              Visszavonás
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}

                  {friendRequests.length === 0 && sentRequests.length === 0 && (
                    <div className="text-center py-12 text-dark-500">
                      Nincsenek függőben lévő kérések
                    </div>
                  )}
                </>
              )}

              {activeTab === 'search' && (
                <>
                  {searchResults.map((user) => (
                    <Card key={user.id} className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold">
                            {(user.display_name || user.username)[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-dark-900 dark:text-white">
                              {user.display_name || user.username}
                            </p>
                            {user.display_name && (
                              <p className="text-sm text-dark-500">@{user.username}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {user.friend_status?.is_blocking && (
                            <Badge variant="error">Tiltva</Badge>
                          )}
                          {user.friend_status?.is_blocked && (
                            <Badge variant="secondary">Tiltott téged</Badge>
                          )}
                          {user.friend_status?.is_friend && (
                            <Badge variant="success">Barát</Badge>
                          )}
                          {user.friend_status?.sent_request && (
                            <Badge variant="warning">Kérés elküldve</Badge>
                          )}
                          {user.friend_status?.has_pending_request && (
                            <Button
                              size="sm"
                              variant="primary"
                              leftIcon={<Check className="w-4 h-4" />}
                              onClick={() => {
                                const request = friendRequests.find(
                                  (r) => r.from_user_id === user.id
                                );
                                if (request) acceptFriendRequest(request.id);
                              }}
                            >
                              Elfogad
                            </Button>
                          )}
                          {!user.friend_status?.is_friend &&
                            !user.friend_status?.sent_request &&
                            !user.friend_status?.has_pending_request &&
                            !user.friend_status?.is_blocking &&
                            !user.friend_status?.is_blocked && (
                              <Button
                                size="sm"
                                variant="primary"
                                leftIcon={<UserPlus className="w-4 h-4" />}
                                onClick={() => sendFriendRequest(user.id)}
                              >
                                Barát jelölés
                              </Button>
                            )}
                        </div>
                      </div>
                    </Card>
                  ))}
                  {searchQuery.length >= 2 && searchResults.length === 0 && (
                    <div className="text-center py-12 text-dark-500">
                      Nincs találat
                    </div>
                  )}
                  {searchQuery.length < 2 && (
                    <div className="text-center py-12 text-dark-500">
                      Írj be legalább 2 karaktert a kereséshez
                    </div>
                  )}
                </>
              )}

              {activeTab === 'blocked' && blockedUsers.map((blocked) => (
                <Card key={blocked.id} className="p-4 border-l-4 border-l-error-500">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-error-500 to-error-600 flex items-center justify-center text-white font-bold">
                        {(blocked.blocked_user?.display_name || blocked.blocked_user?.username || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-dark-900 dark:text-white">
                          {blocked.blocked_user?.display_name || blocked.blocked_user?.username}
                        </p>
                        {blocked.reason && (
                          <p className="text-sm text-dark-500">{blocked.reason}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<UserX className="w-4 h-4" />}
                      onClick={() => unblockUser(blocked.blocked_user_id)}
                    >
                      Tiltás feloldása
                    </Button>
                  </div>
                </Card>
              ))}

              {activeTab === 'friends' && friends.length === 0 && (
                <div className="text-center py-12 text-dark-500">
                  Még nincsenek barátaid. Keress felhasználókat a Keresés fülön!
                </div>
              )}

              {activeTab === 'blocked' && blockedUsers.length === 0 && (
                <div className="text-center py-12 text-dark-500">
                  Nincs tiltott felhasználó
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
