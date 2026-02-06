import { useState, useEffect, memo } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Copy,
  Check,
  Languages,
  Bell,
  BellOff,
  Lock,
  LogOut,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { t, getLocale, setLocale } from '../../lib/i18n';
import { useThemeStore } from '../../stores/themeStore';
import {
  subscribeToNotifications,
  unsubscribeFromNotifications,
  isSubscribed,
  sendTestNotification
} from '../../lib/pushNotifications';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AccountSettingsCardProps {
  user: User;
  profile: {
    username?: string;
    pin_code?: string;
  } | null;
  updateProfile: (updates?: any) => Promise<any>;
  signOut: () => Promise<void>;
}

export const AccountSettingsCard = memo(function AccountSettingsCard({ user, profile, updateProfile, signOut }: AccountSettingsCardProps) {
  const { theme, setTheme } = useThemeStore();
  const navigate = useNavigate();

  const [locale, setLocaleState] = useState(getLocale());
  const [pinCode, setPinCode] = useState('');
  const [isEditingPin, setIsEditingPin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pinSaveSuccess, setPinSaveSuccess] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const check = async () => {
      const subscribed = await isSubscribed();
      setPushEnabled(subscribed);
    };
    check();
  }, []);

  const handleLocaleChange = (newLocale: string) => {
    setLocale(newLocale);
    setLocaleState(newLocale);
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const referralCode = profile?.username || user?.id?.slice(0, 8);
  const referralLink = `${window.location.origin}/r/${referralCode}`;

  const handleSavePin = async () => {
    if (pinCode.length !== 6) {
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
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
    </>
  );
});
