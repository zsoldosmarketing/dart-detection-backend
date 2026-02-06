import { useState, useEffect, useRef } from 'react';
import {
  Mail,
  Users,
  UserPlus,
  X,
  Camera,
} from 'lucide-react';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { ImageEditor } from '../components/ui/ImageEditor';
import { FriendsManagementModal } from '../components/friends/FriendsManagementModal';
import { SpeechSettingsCard } from '../components/profile/SpeechSettingsCard';
import { StatsSection } from '../components/profile/StatsSection';
import { PreferredDoublesCard } from '../components/profile/PreferredDoublesCard';
import { AccountSettingsCard } from '../components/profile/AccountSettingsCard';
import { t } from '../lib/i18n';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

export function ProfilePage() {
  const { user, profile, signOut, updateProfile } = useAuthStore();

  const [friends, setFriends] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFriendsModal, setShowFriendsModal] = useState(false);

  useEffect(() => {
    loadFriends();
    loadFriendRequests();
  }, [user]);

  const loadFriends = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('friendships')
      .select(`
        id,
        friend_id,
        user_profile!friendships_friend_id_fkey(id, username, display_name)
      `)
      .eq('user_id', user.id);

    setFriends(data || []);
  };

  const loadFriendRequests = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('friend_requests')
      .select(`
        id,
        from_user_id,
        user_profile!friend_requests_from_user_id_fkey(id, username, display_name)
      `)
      .eq('to_user_id', user.id)
      .eq('status', 'pending');

    setFriendRequests(data || []);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Csak kep fajlokat tolthetsz fel');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('A kep maximum 5MB lehet');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setEditingImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAvatar = async (blob: Blob) => {
    if (!user) return;

    setUploadingAvatar(true);
    try {
      const fileName = `${user.id}/avatar.webp`;

      const { data: existingFiles } = await supabase.storage
        .from('profile-pictures')
        .list(user.id);

      if (existingFiles && existingFiles.length > 0) {
        await supabase.storage
          .from('profile-pictures')
          .remove([`${user.id}/${existingFiles[0].name}`]);
      }

      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, blob, {
          contentType: 'image/webp',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

      await updateProfile({ avatar_url: publicUrl });

      setEditingImage(null);
    } catch (error) {
      console.error('Avatar upload error:', error);
      alert('Hiba tortent a kep feltoltese soran');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim() || !user) return;

    const { data } = await supabase
      .from('user_profile')
      .select('id, username, display_name')
      .ilike('username', `%${searchQuery}%`)
      .neq('id', user.id)
      .limit(10);

    setSearchResults(data || []);
  };

  const sendFriendRequest = async (toUserId: string) => {
    if (!user) return;

    await supabase.from('friend_requests').insert({
      from_user_id: user.id,
      to_user_id: toUserId,
    });

    setSearchQuery('');
    setSearchResults([]);
  };

  const acceptFriendRequest = async (requestId: string) => {
    const { error } = await supabase.rpc('accept_friend_request', { request_id: requestId });

    if (!error) {
      loadFriends();
      loadFriendRequests();
    }
  };

  const rejectFriendRequest = async (requestId: string) => {
    await supabase
      .from('friend_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);

    loadFriendRequests();
  };

  const removeFriend = async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    loadFriends();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-dark-900 dark:text-white">{t('nav.profile')}</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <div className="text-center">
              <div className="relative inline-block">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Profilkep"
                    className="w-24 h-24 rounded-full object-cover mx-auto"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 mx-auto flex items-center justify-center text-white text-3xl font-bold">
                    {profile?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-primary-500 hover:bg-primary-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                  disabled={uploadingAvatar}
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              <h2 className="text-xl font-semibold text-dark-900 dark:text-white mt-4">
                {profile?.display_name || profile?.username || 'Jatekos'}
              </h2>
              <p className="text-dark-500 dark:text-dark-400 text-sm">
                @{profile?.username || 'username'}
              </p>
            </div>

            <div className="mt-6 pt-6 border-t border-dark-200 dark:border-dark-700">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-dark-400" />
                <span className="text-dark-600 dark:text-dark-300">{user?.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm mt-3">
                <Badge variant="primary">
                  Skill: {profile?.skill_rating?.toFixed(1) || '5.0'}
                </Badge>
              </div>
            </div>
          </Card>

          {user && (
            <AccountSettingsCard
              user={user}
              profile={profile}
              updateProfile={updateProfile}
              signOut={signOut}
            />
          )}

          <SpeechSettingsCard />
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardTitle>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Barátok ({friends.length})
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<UserPlus className="w-4 h-4" />}
                  onClick={() => setShowFriendsModal(true)}
                >
                  Kezelés
                </Button>
              </div>
            </CardTitle>

            {friendRequests.length > 0 && (
              <div className="mt-4 p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg">
                <h4 className="text-sm font-semibold text-dark-900 dark:text-white mb-2">
                  Barát kérelmek ({friendRequests.length})
                </h4>
                <div className="space-y-2">
                  {friendRequests.map((req: any) => (
                    <div key={req.id} className="flex items-center justify-between bg-white dark:bg-dark-800 p-2 rounded">
                      <span className="text-sm">
                        @{req.user_profile?.username || 'Unknown'}
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => acceptFriendRequest(req.id)}>
                          Elfogad
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => rejectFriendRequest(req.id)}>
                          Elutasít
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <div className="flex gap-2 mb-3">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                  placeholder="Keress felhasználót..."
                />
                <Button onClick={searchUsers} leftIcon={<UserPlus className="w-4 h-4" />}>
                  Keresés
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2 mb-4">
                  {searchResults.map((user: any) => (
                    <div key={user.id} className="flex items-center justify-between p-2 bg-dark-50 dark:bg-dark-700 rounded">
                      <span className="text-sm">@{user.username}</span>
                      <Button size="sm" onClick={() => sendFriendRequest(user.id)}>
                        Hozzáad
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                {friends.map((friendship: any) => (
                  <div key={friendship.id} className="flex items-center justify-between p-3 bg-dark-50 dark:bg-dark-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center text-white text-sm font-semibold">
                        {friendship.user_profile?.username?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span className="text-sm font-medium">
                        @{friendship.user_profile?.username || 'Unknown'}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeFriend(friendship.id)}
                      leftIcon={<X className="w-3 h-3" />}
                    >
                      Törlés
                    </Button>
                  </div>
                ))}
                {friends.length === 0 && (
                  <p className="text-center text-sm text-dark-500 py-4">
                    Még nincs barátod. Keress rá másokra!
                  </p>
                )}
              </div>
            </div>
          </Card>

          <StatsSection profile={profile} />

          {user && (
            <PreferredDoublesCard
              userId={user.id}
              preferredDoubles={profile?.preferred_doubles as unknown as number[] | null}
            />
          )}
        </div>
      </div>

      {showFriendsModal && (
        <FriendsManagementModal onClose={() => setShowFriendsModal(false)} />
      )}

      {editingImage && (
        <ImageEditor
          imageUrl={editingImage}
          onSave={handleSaveAvatar}
          onCancel={() => setEditingImage(null)}
        />
      )}
    </div>
  );
}
