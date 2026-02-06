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

  const iconButtonClass =
    'p-2.5 rounded-xl text-dark-500 dark:text-dark-400 hover:bg-dark-100/80 dark:hover:bg-white/5 hover:text-dark-700 dark:hover:text-dark-200 transition-all duration-200';

  return (
    <>
      <header className="h-16 bg-white/70 dark:bg-dark-950/70 backdrop-blur-xl border-b border-dark-200/50 dark:border-white/5 fixed top-0 right-0 left-0 md:left-64 z-30">
        <div className="flex items-center justify-between h-full px-4 md:px-6">
          <div className="flex items-center gap-3 md:hidden">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/20">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div className="absolute inset-0 w-9 h-9 rounded-xl bg-primary-500/20 blur-md -z-10" />
            </div>
            <span className="text-lg font-bold text-dark-900 dark:text-white tracking-tight">
              DartsTraining
            </span>
          </div>

          <div className="hidden md:block" />

          <div className="flex items-center gap-1.5">
            {isInstallable && !isInstalled && (
              <button
                onClick={handleInstall}
                className="p-2.5 rounded-xl text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all duration-200 relative"
                aria-label="Install app"
                title="Alkalmazas telepitese"
              >
                <Download className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-primary-500 rounded-full animate-pulse" />
              </button>
            )}

            {user && (
              <button
                onClick={() => setShowCameraShare(true)}
                className={iconButtonClass}
                aria-label="Share camera"
                title="Kamera megosztasa mas eszkozzel"
              >
                <Camera className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={toggleTheme}
              className={iconButtonClass}
              aria-label="Toggle theme"
            >
              <div className="relative w-5 h-5">
                <Sun
                  className="w-5 h-5 absolute inset-0 transition-all duration-300"
                  style={{
                    opacity: resolvedTheme === 'dark' ? 1 : 0,
                    transform: resolvedTheme === 'dark' ? 'rotate(0deg) scale(1)' : 'rotate(90deg) scale(0)',
                  }}
                />
                <Moon
                  className="w-5 h-5 absolute inset-0 transition-all duration-300"
                  style={{
                    opacity: resolvedTheme === 'dark' ? 0 : 1,
                    transform: resolvedTheme === 'dark' ? 'rotate(-90deg) scale(0)' : 'rotate(0deg) scale(1)',
                  }}
                />
              </div>
            </button>

            {user && (
              <>
                <Link
                  to="/inbox"
                  className="relative p-2.5 rounded-xl text-dark-500 dark:text-dark-400 hover:bg-dark-100/80 dark:hover:bg-white/5 hover:text-dark-700 dark:hover:text-dark-200 transition-all duration-200"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <>
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-error-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-dark-950">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-error-500 rounded-full animate-ping opacity-30" />
                    </>
                  )}
                </Link>

                <Link
                  to="/profile"
                  className={iconButtonClass}
                  aria-label="Profile"
                  title="Profilom"
                >
                  <User className="w-5 h-5" />
                </Link>

                <button
                  onClick={handleSignOut}
                  className={iconButtonClass}
                  aria-label="Sign out"
                  title="Kijelentkezes"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            )}

            {!user && (
              <div className="flex items-center gap-2 ml-1">
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    {t('auth.login')}
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">
                    {t('auth.register')}
                  </Button>
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
