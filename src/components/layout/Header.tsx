import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Sun, Moon, LogOut, Target, Download, User, Camera } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { usePWAInstall } from '../../lib/pwaInstall';
import { Button } from '../ui/Button';
import { PWAInstallPrompt } from '../ui/PWAInstallPrompt';
import { RemoteCameraShareModal } from '../camera/RemoteCameraShareModal';
import { t } from '../../lib/i18n';

export function Header() {
  const { user, signOut } = useAuthStore();
  const { theme, setTheme, resolvedTheme } = useThemeStore();
  const { unreadCount } = useNotificationStore();
  const { isInstallable, isInstalled, install, showPrompt, dismissPrompt } = usePWAInstall();
  const navigate = useNavigate();
  const [showCameraShare, setShowCameraShare] = useState(false);

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      dismissPrompt();
    }
  };

  return (
    <>
      <header className="h-16 bg-white dark:bg-dark-800 border-b border-dark-200 dark:border-dark-700 fixed top-0 right-0 left-0 md:left-64 z-30">
        <div className="flex items-center justify-between h-full px-4 md:px-6">
          <div className="flex items-center gap-3 md:hidden">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-dark-900 dark:text-white">DartsTraining</span>
          </div>

          <div className="hidden md:block" />

          <div className="flex items-center gap-2">
            {isInstallable && !isInstalled && (
              <button
                onClick={handleInstall}
                className="p-2 rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors relative group"
                aria-label="Install app"
                title="Alkalmazás telepítése"
              >
                <Download className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary-500 rounded-full animate-pulse" />
              </button>
            )}

            {user && (
              <button
                onClick={() => setShowCameraShare(true)}
                className="p-2 rounded-lg text-dark-500 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                aria-label="Share camera"
                title="Kamera megosztasa mas eszkozzel"
              >
                <Camera className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-dark-500 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
              aria-label="Toggle theme"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

          {user && (
            <>
              <Link
                to="/inbox"
                className="relative p-2 rounded-lg text-dark-500 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-error-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>

              <Link
                to="/profile"
                className="p-2 rounded-lg text-dark-500 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                aria-label="Profile"
                title="Profilom"
              >
                <User className="w-5 h-5" />
              </Link>

              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg text-dark-500 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                aria-label="Sign out"
                title="Kijelentkezés"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </>
          )}

          {!user && (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  {t('auth.login')}
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm">{t('auth.register')}</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>

    {showPrompt && <PWAInstallPrompt onInstall={handleInstall} onDismiss={dismissPrompt} />}

    <RemoteCameraShareModal
      isOpen={showCameraShare}
      onClose={() => setShowCameraShare(false)}
    />
    </>
  );
}
