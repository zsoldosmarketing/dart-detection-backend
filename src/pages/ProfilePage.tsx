import { useState, useEffect, useRef } from 'react';
import {
  User,
  Mail,
  Trophy,
  Target,
  TrendingUp,
  Award,
  Settings,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Share2,
  Copy,
  Check,
  Languages,
  Bell,
  BellOff,
  Lock,
  Users,
  UserPlus,
  X,
  Upload,
  Camera,
  ChevronRight,
  Mic,
  Volume2,
  Wifi,
  WifiOff,
  Download,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { ImageEditor } from '../components/ui/ImageEditor';
import { FriendsManagementModal } from '../components/friends/FriendsManagementModal';
import { t, getLocale, setLocale } from '../lib/i18n';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import {
  subscribeToNotifications,
  unsubscribeFromNotifications,
  isSubscribed,
  sendTestNotification
} from '../lib/pushNotifications';
import { supabase } from '../lib/supabase';
import { speechEngine, offlineModels, type SpeechEngineType } from '../lib/offlineSpeech';

export function ProfilePage() {
  const { user, profile, signOut, updateProfile } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const navigate = useNavigate();

  const [copied, setCopied] = useState(false);
  const [locale, setLocaleState] = useState(getLocale());
  const [pinCode, setPinCode] = useState('');
  const [isEditingPin, setIsEditingPin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pinSaveSuccess, setPinSaveSuccess] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingDoubles, setIsEditingDoubles] = useState(false);
  const [selectedDoubles, setSelectedDoubles] = useState<number[]>([]);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [speechEngineType, setSpeechEngineType] = useState<SpeechEngineType>('web');
  const [offlineModelsReady, setOfflineModelsReady] = useState(false);
  const [isDownloadingModels, setIsDownloadingModels] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDeletingModels, setIsDeletingModels] = useState(false);

  useEffect(() => {
    checkPushStatus();
    loadFriends();
    loadFriendRequests();
    checkOfflineModels();
  }, [user]);

  const checkOfflineModels = async () => {
    setSpeechEngineType(speechEngine.getEngineType());
    const ready = await speechEngine.checkOfflineReady();
    setOfflineModelsReady(ready);
  };

  const handleDownloadOfflineModels = async () => {
    setIsDownloadingModels(true);
    setDownloadProgress(0);
    try {
      await speechEngine.downloadOfflineModels((progress) => {
        setDownloadProgress(progress);
      });
      setOfflineModelsReady(true);
    } catch (error) {
      console.error('Download error:', error);
      alert('Hiba a modell letoltese soran');
    } finally {
      setIsDownloadingModels(false);
    }
  };

  const handleDeleteOfflineModels = async () => {
    if (!confirm('Biztosan torolod az offline beszed modellt? (kb. 63MB tarol fog felszabadulni)')) return;
    setIsDeletingModels(true);
    try {
      await speechEngine.deleteOfflineModels();
      setOfflineModelsReady(false);
      setSpeechEngineType('web');
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setIsDeletingModels(false);
    }
  };

  const handleSpeechEngineChange = async (type: SpeechEngineType) => {
    if (type === 'offline' && !offlineModelsReady) {
      alert('Eloszor toltsd le az offline modelleket!');
      return;
    }
    try {
      await speechEngine.setEngineType(type);
      setSpeechEngineType(type);
    } catch (error) {
      console.error('Engine change error:', error);
    }
  };

  useEffect(() => {
    if (profile?.preferred_doubles) {
      setSelectedDoubles(profile.preferred_doubles as unknown as number[]);
    }
  }, [profile]);

  const checkPushStatus = async () => {
    const subscribed = await isSubscribed();
    setPushEnabled(subscribed);
  };

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

  const handleLocaleChange = (newLocale: string) => {
    setLocale(newLocale);
    setLocaleState(newLocale);
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const referralCode = profile?.username || user?.id?.slice(0, 8);
  const referralLink = `${window.location.origin}/r/${referralCode}`;

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

  const handleSavePin = async () => {
    if (!user || pinCode.length !== 6) {
      alert('A PIN kódnak pontosan 6 számjegyűnek kell lennie');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_profile')
        .update({ pin_code: pinCode })
        .eq('id', user.id);

      if (error) {
        alert(error.message);
      } else {
        setIsEditingPin(false);
        setPinCode('');
        await updateProfile();
        setPinSaveSuccess(true);
        setTimeout(() => setPinSaveSuccess(false), 3000);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const togglePushNotifications = async () => {
    if (!user) return;

    if (pushEnabled) {
      await unsubscribeFromNotifications(user.id);
      setPushEnabled(false);
    } else {
      const success = await subscribeToNotifications(user.id);
      if (success) {
        setPushEnabled(true);
        sendTestNotification();
      }
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveDoubles = async () => {
    if (!user || selectedDoubles.length === 0) return;

    try {
      const { error } = await supabase
        .from('user_profile')
        .update({ preferred_doubles: selectedDoubles })
        .eq('id', user.id);

      if (error) throw error;

      setIsEditingDoubles(false);
      window.location.reload();
    } catch (error) {
      console.error('Error updating preferred doubles:', error);
    }
  };

  const toggleDouble = (num: number) => {
    setSelectedDoubles(prev => {
      if (prev.includes(num)) {
        return prev.filter(d => d !== num);
      } else {
        if (prev.length >= 10) {
          return [...prev.slice(1), num];
        }
        return [...prev, num];
      }
    });
  };

  const stats = [
    { label: t('stats.games_played'), value: profile?.total_games_played || 0, icon: Target },
    { label: t('stats.wins'), value: profile?.total_wins || 0, icon: Trophy },
    { label: t('stats.average'), value: profile?.average_score?.toFixed(1) || '0.0', icon: TrendingUp },
    { label: t('stats.highest_checkout'), value: profile?.highest_checkout || 0, icon: Award },
    { label: t('stats.current_streak'), value: `${profile?.current_streak || 0} nap`, icon: Target },
    { label: t('stats.longest_streak'), value: `${profile?.longest_streak || 0} nap`, icon: Trophy },
  ];

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

          <Card>
            <CardTitle>{t('profile.theme')}</CardTitle>
            <div className="mt-4 flex gap-2">
              {[
                { value: 'light', label: t('profile.theme.light'), icon: Sun },
                { value: 'dark', label: t('profile.theme.dark'), icon: Moon },
                { value: 'system', label: t('profile.theme.system'), icon: Monitor },
              ].map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value as 'light' | 'dark' | 'system')}
                    className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      theme === option.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-dark-200 dark:border-dark-700 hover:border-dark-300 dark:hover:border-dark-600'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${theme === option.value ? 'text-primary-600 dark:text-primary-400' : 'text-dark-500'}`} />
                    <span className={`text-xs font-medium ${theme === option.value ? 'text-primary-600 dark:text-primary-400' : 'text-dark-600 dark:text-dark-400'}`}>
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardTitle>
              <div className="flex items-center gap-2">
                <Languages className="w-5 h-5" />
                Language / Nyelv
              </div>
            </CardTitle>
            <div className="mt-4 flex gap-2">
              {[
                { value: 'en', label: 'English', flag: '🇬🇧' },
                { value: 'hu', label: 'Magyar', flag: '🇭🇺' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleLocaleChange(option.value)}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    locale === option.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-dark-200 dark:border-dark-700 hover:border-dark-300 dark:hover:border-dark-600'
                  }`}
                >
                  <span className="text-2xl">{option.flag}</span>
                  <span className={`text-xs font-medium ${locale === option.value ? 'text-primary-600 dark:text-primary-400' : 'text-dark-600 dark:text-dark-400'}`}>
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardTitle>
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                PIN Kód (Helyi Játék)
              </div>
            </CardTitle>
            <p className="text-sm text-dark-500 dark:text-dark-400 mt-2">
              6 jegyű PIN kód helyi meccsekhez való csatlakozáshoz
            </p>

            {!profile?.pin_code && !isEditingPin && (
              <div className="mt-3 p-3 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg">
                <p className="text-sm text-warning-700 dark:text-warning-300">
                  Még nincs PIN kód beállítva. Állíts be egyet a helyi játékokhoz!
                </p>
              </div>
            )}

            {pinSaveSuccess && (
              <div className="mt-3 p-3 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg flex items-center gap-2 animate-fade-in">
                <Check className="w-5 h-5 text-success-600 dark:text-success-400" />
                <p className="text-sm text-success-700 dark:text-success-300 font-medium">
                  PIN kód sikeresen {profile?.pin_code ? 'módosítva' : 'beállítva'}!
                </p>
              </div>
            )}

            {isEditingPin ? (
              <div className="mt-4 space-y-3">
                <Input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  maxLength={6}
                />
                <div className="flex gap-2">
                  <Button onClick={handleSavePin} isLoading={isSaving} className="flex-1">
                    Mentés
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditingPin(false)}>
                    Mégse
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {profile?.pin_code && (
                  <div className="p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                      <span className="text-sm text-primary-700 dark:text-primary-300 font-medium">
                        PIN kód beállítva
                      </span>
                    </div>
                    <span className="text-xs text-primary-600 dark:text-primary-400">
                      {profile.pin_code.replace(/./g, '•')}
                    </span>
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={() => setIsEditingPin(true)}
                  className="w-full"
                >
                  {profile?.pin_code ? 'PIN Módosítása' : 'PIN Beállítása'}
                </Button>
              </div>
            )}
          </Card>

          <Card>
            <CardTitle>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {pushEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                  Push Értesítések
                </div>
                <button
                  onClick={togglePushNotifications}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    pushEnabled ? 'bg-primary-600' : 'bg-dark-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      pushEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </CardTitle>
            <p className="text-sm text-dark-500 dark:text-dark-400 mt-2">
              Értesítések játékmeghívásokról, barát kérelmekről és egyéb eseményekről
            </p>
          </Card>

          <Card>
            <CardTitle>
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5" />
                <Volume2 className="w-5 h-5" />
                Hangfelismerés Motor
              </div>
            </CardTitle>
            <p className="text-sm text-dark-500 dark:text-dark-400 mt-2">
              Válaszd ki milyen motorral működjön a hangfelismerés és beszéd
            </p>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => handleSpeechEngineChange('web')}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  speechEngineType === 'web'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-dark-200 dark:border-dark-700 hover:border-dark-300 dark:hover:border-dark-600'
                }`}
              >
                <Wifi className={`w-6 h-6 ${speechEngineType === 'web' ? 'text-primary-600 dark:text-primary-400' : 'text-dark-500'}`} />
                <span className={`text-sm font-medium ${speechEngineType === 'web' ? 'text-primary-600 dark:text-primary-400' : 'text-dark-600 dark:text-dark-400'}`}>
                  Web Speech
                </span>
                <span className="text-xs text-dark-400">Alapértelmezett</span>
              </button>

              <button
                onClick={() => handleSpeechEngineChange('offline')}
                disabled={!offlineModelsReady}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  speechEngineType === 'offline'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : offlineModelsReady
                      ? 'border-dark-200 dark:border-dark-700 hover:border-dark-300 dark:hover:border-dark-600'
                      : 'border-dark-200 dark:border-dark-700 opacity-50 cursor-not-allowed'
                }`}
              >
                <WifiOff className={`w-6 h-6 ${speechEngineType === 'offline' ? 'text-primary-600 dark:text-primary-400' : 'text-dark-500'}`} />
                <span className={`text-sm font-medium ${speechEngineType === 'offline' ? 'text-primary-600 dark:text-primary-400' : 'text-dark-600 dark:text-dark-400'}`}>
                  Offline
                </span>
                <span className="text-xs text-dark-400">Piper TTS</span>
              </button>
            </div>

            <div className="mt-4 p-3 bg-dark-50 dark:bg-dark-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-dark-700 dark:text-dark-300">
                  Offline modellek
                </span>
                {offlineModelsReady ? (
                  <Badge variant="success" size="sm">Letöltve</Badge>
                ) : (
                  <Badge variant="secondary" size="sm">Nincs letöltve</Badge>
                )}
              </div>

              {isDownloadingModels && (
                <div className="space-y-2 mb-3">
                  <div>
                    <div className="flex justify-between text-xs text-dark-500 mb-1">
                      <span>Piper (beszedszintezis)</span>
                      <span>{downloadProgress}%</span>
                    </div>
                    <div className="h-2 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 transition-all duration-300"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {!offlineModelsReady && !isDownloadingModels && (
                <div className="text-xs text-dark-500 dark:text-dark-400 mb-3">
                  <p>Letoltes merete: ~63 MB</p>
                  <p className="mt-1">Offline beszedszintezis magyar Piper hanggal. A hangfelismeres tovabbra is Web Speech API-t hasznalja.</p>
                </div>
              )}

              <div className="flex gap-2">
                {!offlineModelsReady ? (
                  <Button
                    onClick={handleDownloadOfflineModels}
                    isLoading={isDownloadingModels}
                    leftIcon={<Download className="w-4 h-4" />}
                    className="flex-1"
                  >
                    {isDownloadingModels ? 'Letöltés...' : 'Modellek letöltése'}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleDeleteOfflineModels}
                    isLoading={isDeletingModels}
                    leftIcon={<Trash2 className="w-4 h-4" />}
                    className="flex-1"
                  >
                    Modellek törlése
                  </Button>
                )}
              </div>
            </div>

            {speechEngineType === 'web' && (
              <p className="mt-3 text-xs text-dark-400 dark:text-dark-500">
                A Web Speech API a böngésző beépített hangfelismerését használja. Internet kapcsolat szükséges.
              </p>
            )}
            {speechEngineType === 'offline' && (
              <p className="mt-3 text-xs text-dark-400 dark:text-dark-500">
                Az offline mod helyi Piper modellt hasznal a beszedszintezishez. A hangfelismeres Web Speech API-val mukodik.
              </p>
            )}
          </Card>

          <Card>
            <CardTitle>{t('profile.referral')}</CardTitle>
            <p className="text-sm text-dark-500 dark:text-dark-400 mt-2">
              Hivd meg barataidat es szerezz jutalmakat!
            </p>
            <div className="mt-4 flex gap-2">
              <Input
                value={referralLink}
                readOnly
                className="text-sm"
              />
              <Button
                variant="outline"
                onClick={copyReferralLink}
                leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              >
                {copied ? 'Masolva' : 'Masolas'}
              </Button>
            </div>
          </Card>

          <Button
            variant="outline"
            className="w-full"
            leftIcon={<LogOut className="w-4 h-4" />}
            onClick={handleSignOut}
          >
            {t('auth.logout')}
          </Button>
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

          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>{t('profile.stats')}</CardTitle>
              <Link to="/statistics">
                <Button variant="ghost" size="sm" rightIcon={<ChevronRight className="w-4 h-4" />}>
                  Részletes
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="p-4 rounded-lg bg-dark-50 dark:bg-dark-700/50"
                  >
                    <div className="flex items-center gap-2 text-dark-500 dark:text-dark-400 mb-2">
                      <Icon className="w-4 h-4" />
                      <span className="text-xs">{stat.label}</span>
                    </div>
                    <p className="text-xl font-bold text-dark-900 dark:text-white">
                      {stat.value}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-2">
              <CardTitle>{t('profile.preferred_doubles')}</CardTitle>
              {!isEditingDoubles && (
                <button
                  onClick={() => setIsEditingDoubles(true)}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                >
                  Szerkesztés
                </button>
              )}
            </div>
            <p className="text-sm text-dark-500 dark:text-dark-400 mt-1 mb-4">
              A checkout engine ezeket a duplakat preferalja
            </p>

            {isEditingDoubles ? (
              <div className="space-y-4">
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                    <button
                      key={num}
                      onClick={() => toggleDouble(num)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedDoubles.includes(num)
                          ? 'bg-primary-600 text-white'
                          : 'bg-dark-100 dark:bg-dark-700 text-dark-700 dark:text-dark-300 hover:bg-dark-200 dark:hover:bg-dark-600'
                      }`}
                    >
                      D{num}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-dark-500 dark:text-dark-400">
                  Max 10 duplát választhatsz. A sorrend számít: az első 3 lesz a legfontosabb.
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveDoubles}
                    disabled={selectedDoubles.length === 0}
                    className="flex-1"
                  >
                    Mentés
                  </Button>
                  <Button
                    onClick={() => {
                      setIsEditingDoubles(false);
                      setSelectedDoubles((profile?.preferred_doubles as unknown as number[]) || [20, 16, 8]);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Mégse
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {((profile?.preferred_doubles as unknown as number[]) || [20, 16, 8]).slice(0, 3).map((num: number) => (
                  <Badge key={num} variant="primary" size="md">
                    D{num}
                  </Badge>
                ))}
                {((profile?.preferred_doubles as unknown as number[]) || []).length > 3 && (
                  <Badge variant="secondary" size="md">
                    +{((profile?.preferred_doubles as unknown as number[]) || []).length - 3} több
                  </Badge>
                )}
              </div>
            )}
          </Card>

          <Card>
            <CardTitle>{t('profile.achievements')}</CardTitle>
            <div className="mt-4 grid grid-cols-4 sm:grid-cols-6 gap-4">
              {[
                { name: 'First Game', icon: '🎯', unlocked: (profile?.total_games_played || 0) > 0 },
                { name: 'First Win', icon: '🏆', unlocked: (profile?.total_wins || 0) > 0 },
                { name: '3 Day Streak', icon: '🔥', unlocked: (profile?.longest_streak || 0) >= 3 },
                { name: '100+ Checkout', icon: '💯', unlocked: (profile?.highest_checkout || 0) >= 100 },
                { name: '7 Day Streak', icon: '⭐', unlocked: (profile?.longest_streak || 0) >= 7 },
                { name: '170 Checkout', icon: '👑', unlocked: (profile?.highest_checkout || 0) >= 170 },
              ].map((achievement) => (
                <div
                  key={achievement.name}
                  className={`flex flex-col items-center p-3 rounded-lg ${
                    achievement.unlocked
                      ? 'bg-primary-50 dark:bg-primary-900/20'
                      : 'bg-dark-100 dark:bg-dark-800 opacity-50'
                  }`}
                  title={achievement.name}
                >
                  <span className="text-2xl">{achievement.icon}</span>
                  <span className="text-[10px] text-dark-500 mt-1 text-center truncate w-full">
                    {achievement.name}
                  </span>
                </div>
              ))}
            </div>
          </Card>
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
