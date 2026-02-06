import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Target,
  Gamepad2,
  Users,
  Trophy,
  Bell,
  User,
  Settings,
  Swords,
} from 'lucide-react';
import clsx from 'clsx';
import { t } from '../../lib/i18n';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';

export function Navigation() {
  const location = useLocation();
  const { user, isAdmin } = useAuthStore();
  const { unreadCount } = useNotificationStore();

  const isActive = (path: string, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const isGameActive = isActive('/game') || isActive('/arena');

  const desktopLinkClass = (active: boolean) =>
    clsx(
      'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative group',
      active
        ? 'bg-primary-500/10 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400'
        : 'text-dark-500 dark:text-dark-400 hover:bg-dark-100/80 dark:hover:bg-white/5 hover:text-dark-900 dark:hover:text-dark-200'
    );

  const desktopAccent = (active: boolean) =>
    clsx(
      'absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-r-full transition-all duration-200',
      active ? 'bg-primary-500' : 'bg-transparent'
    );

  const mobileLinkClass = (active: boolean) =>
    clsx(
      'flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all duration-200 relative',
      active
        ? 'text-primary-600 dark:text-primary-400'
        : 'text-dark-400 dark:text-dark-500 hover:text-dark-600 dark:hover:text-dark-300'
    );

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="bg-white/80 dark:bg-dark-900/80 backdrop-blur-xl border-t border-dark-200/50 dark:border-white/5">
          <div className="flex items-center justify-around h-16 px-1 max-w-lg mx-auto relative">
            <NavLink to="/" className={mobileLinkClass(isActive('/', true))}>
              {isActive('/', true) && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-primary-500" />
              )}
              <Home className="w-5 h-5" />
              <span className="text-[10px] font-medium">{t('nav.dashboard')}</span>
            </NavLink>

            {user && (
              <NavLink to="/training" className={mobileLinkClass(isActive('/training'))}>
                {isActive('/training') && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-primary-500" />
                )}
                <Target className="w-5 h-5" />
                <span className="text-[10px] font-medium">{t('nav.training')}</span>
              </NavLink>
            )}

            {user && (
              <NavLink
                to="/game"
                className="flex flex-col items-center justify-center flex-1 h-full relative -mt-5"
              >
                <div
                  className={clsx(
                    'w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300',
                    isGameActive
                      ? 'bg-gradient-to-br from-primary-500 to-primary-700 shadow-primary-500/40 scale-105'
                      : 'bg-gradient-to-br from-primary-500 to-primary-600 shadow-primary-500/30 hover:shadow-primary-500/50 hover:scale-105'
                  )}
                >
                  <Gamepad2 className="w-6 h-6 text-white" />
                </div>
                <span
                  className={clsx(
                    'text-[10px] font-semibold mt-1',
                    isGameActive
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-dark-400 dark:text-dark-500'
                  )}
                >
                  {t('nav.games')}
                </span>
              </NavLink>
            )}

            {user && (
              <NavLink to="/clubs" className={mobileLinkClass(isActive('/clubs'))}>
                {isActive('/clubs') && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-primary-500" />
                )}
                <Users className="w-5 h-5" />
                <span className="text-[10px] font-medium">{t('nav.clubs')}</span>
              </NavLink>
            )}

            {user && (
              <NavLink to="/tournaments" className={mobileLinkClass(isActive('/tournaments'))}>
                {isActive('/tournaments') && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-primary-500" />
                )}
                <Trophy className="w-5 h-5" />
                <span className="text-[10px] font-medium">{t('nav.tournaments')}</span>
              </NavLink>
            )}
          </div>
        </div>
      </nav>

      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-white/70 dark:bg-dark-950/70 backdrop-blur-xl border-r border-dark-200/50 dark:border-white/5 flex-col z-40">
        <div className="flex items-center gap-3 h-16 px-6">
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

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <NavLink to="/" className={desktopLinkClass(isActive('/', true))}>
            <span className={desktopAccent(isActive('/', true))} />
            <Home className="w-5 h-5" />
            <span className="font-medium text-sm">{t('nav.dashboard')}</span>
          </NavLink>

          {user && (
            <>
              <NavLink to="/training" className={desktopLinkClass(isActive('/training'))}>
                <span className={desktopAccent(isActive('/training'))} />
                <Target className="w-5 h-5" />
                <span className="font-medium text-sm">{t('nav.training')}</span>
              </NavLink>

              <NavLink
                to="/game"
                className={clsx(
                  'flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 mt-1 mb-1',
                  isGameActive
                    ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-600/30'
                    : 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md shadow-primary-500/20 hover:shadow-lg hover:shadow-primary-500/30 hover:from-primary-600 hover:to-primary-700'
                )}
              >
                <Gamepad2 className="w-5 h-5" />
                <span className="font-semibold text-sm">{t('nav.games')}</span>
              </NavLink>

              <NavLink to="/arena" className={desktopLinkClass(isActive('/arena'))}>
                <span className={desktopAccent(isActive('/arena'))} />
                <Swords className="w-5 h-5" />
                <span className="font-medium text-sm">{t('nav.arena')}</span>
              </NavLink>

              <NavLink to="/clubs" className={desktopLinkClass(isActive('/clubs'))}>
                <span className={desktopAccent(isActive('/clubs'))} />
                <Users className="w-5 h-5" />
                <span className="font-medium text-sm">{t('nav.clubs')}</span>
              </NavLink>

              <NavLink to="/tournaments" className={desktopLinkClass(isActive('/tournaments'))}>
                <span className={desktopAccent(isActive('/tournaments'))} />
                <Trophy className="w-5 h-5" />
                <span className="font-medium text-sm">{t('nav.tournaments')}</span>
              </NavLink>
            </>
          )}

          {user && (
            <>
              <div className="pt-6 pb-2 px-3">
                <span className="text-[11px] font-semibold text-dark-400 dark:text-dark-600 uppercase tracking-widest">
                  Fiok
                </span>
              </div>

              <NavLink to="/inbox" className={desktopLinkClass(isActive('/inbox'))}>
                <span className={desktopAccent(isActive('/inbox'))} />
                <Bell className="w-5 h-5" />
                <span className="font-medium text-sm">{t('nav.inbox')}</span>
                {unreadCount > 0 && (
                  <span className="ml-auto bg-error-500 text-white text-[10px] font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </NavLink>

              <NavLink to="/profile" className={desktopLinkClass(isActive('/profile'))}>
                <span className={desktopAccent(isActive('/profile'))} />
                <User className="w-5 h-5" />
                <span className="font-medium text-sm">{t('nav.profile')}</span>
              </NavLink>

              {isAdmin && (
                <NavLink to="/crm" className={desktopLinkClass(isActive('/crm'))}>
                  <span className={desktopAccent(isActive('/crm'))} />
                  <Settings className="w-5 h-5" />
                  <span className="font-medium text-sm">{t('nav.crm')}</span>
                </NavLink>
              )}
            </>
          )}
        </div>

        {user && (
          <div className="p-4 border-t border-dark-200/50 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold text-sm shadow-md shadow-primary-500/20">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-dark-900 dark:text-white truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
