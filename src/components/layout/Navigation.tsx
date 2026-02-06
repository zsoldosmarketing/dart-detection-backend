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
} from 'lucide-react';
import clsx from 'clsx';
import { t } from '../../lib/i18n';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';

interface NavItem {
  path: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAuth?: boolean;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { path: '/', labelKey: 'nav.dashboard', icon: Home },
  { path: '/training', labelKey: 'nav.training', icon: Target, requiresAuth: true },
  { path: '/clubs', labelKey: 'nav.clubs', icon: Users, requiresAuth: true },
  { path: '/tournaments', labelKey: 'nav.tournaments', icon: Trophy, requiresAuth: true },
];

export function Navigation() {
  const location = useLocation();
  const { user, isAdmin } = useAuthStore();
  const { unreadCount } = useNotificationStore();

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-dark-800 border-t border-dark-200 dark:border-dark-700 md:hidden">
        <div className="flex items-center justify-around h-16 px-2">
          <NavLink
            to="/"
            className={clsx(
              'flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors',
              location.pathname === '/'
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-300'
            )}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">{t('nav.dashboard')}</span>
          </NavLink>

          {user && (
            <NavLink
              to="/training"
              className={clsx(
                'flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors',
                location.pathname.startsWith('/training')
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-300'
              )}
            >
              <Target className="w-5 h-5" />
              <span className="text-[10px] font-medium">{t('nav.training')}</span>
            </NavLink>
          )}

          {user && (
            <NavLink
              to="/game"
              className="flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors relative -mt-6"
            >
              <div className={clsx(
                'w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all',
                location.pathname.startsWith('/game') || location.pathname.startsWith('/arena')
                  ? 'bg-primary-600'
                  : 'bg-primary-500 hover:bg-primary-600'
              )}>
                <Gamepad2 className="w-6 h-6 text-white" />
              </div>
              <span className={clsx(
                'text-[10px] font-medium mt-1',
                location.pathname.startsWith('/game') || location.pathname.startsWith('/arena')
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-dark-500 dark:text-dark-400'
              )}>
                {t('nav.games')}
              </span>
            </NavLink>
          )}

          {user && (
            <NavLink
              to="/clubs"
              className={clsx(
                'flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors',
                location.pathname.startsWith('/clubs')
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-300'
              )}
            >
              <Users className="w-5 h-5" />
              <span className="text-[10px] font-medium">{t('nav.clubs')}</span>
            </NavLink>
          )}

          {user && (
            <NavLink
              to="/tournaments"
              className={clsx(
                'flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors',
                location.pathname.startsWith('/tournaments')
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-300'
              )}
            >
              <Trophy className="w-5 h-5" />
              <span className="text-[10px] font-medium">{t('nav.tournaments')}</span>
            </NavLink>
          )}
        </div>
      </nav>

      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-dark-800 border-r border-dark-200 dark:border-dark-700 flex-col z-40">
        <div className="flex items-center gap-3 h-16 px-6 border-b border-dark-200 dark:border-dark-700">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
            <Target className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-dark-900 dark:text-white">DartsTraining</span>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3">
          <div className="space-y-1">
            <NavLink
              to="/"
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                location.pathname === '/'
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                  : 'text-dark-600 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-700/50 hover:text-dark-900 dark:hover:text-dark-100'
              )}
            >
              <Home className="w-5 h-5" />
              <span className="font-medium">{t('nav.dashboard')}</span>
            </NavLink>

            {user && (
              <>
                <NavLink
                  to="/training"
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                    location.pathname.startsWith('/training')
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                      : 'text-dark-600 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-700/50 hover:text-dark-900 dark:hover:text-dark-100'
                  )}
                >
                  <Target className="w-5 h-5" />
                  <span className="font-medium">{t('nav.training')}</span>
                </NavLink>

                <NavLink
                  to="/game"
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                    location.pathname.startsWith('/game') || location.pathname.startsWith('/arena')
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                      : 'bg-primary-500 text-white hover:bg-primary-600 shadow-md hover:shadow-lg hover:shadow-primary-500/30'
                  )}
                >
                  <Gamepad2 className="w-5 h-5" />
                  <span className="font-medium">{t('nav.games')}</span>
                </NavLink>

                <NavLink
                  to="/clubs"
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                    location.pathname.startsWith('/clubs')
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                      : 'text-dark-600 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-700/50 hover:text-dark-900 dark:hover:text-dark-100'
                  )}
                >
                  <Users className="w-5 h-5" />
                  <span className="font-medium">{t('nav.clubs')}</span>
                </NavLink>

                <NavLink
                  to="/tournaments"
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                    location.pathname.startsWith('/tournaments')
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                      : 'text-dark-600 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-700/50 hover:text-dark-900 dark:hover:text-dark-100'
                  )}
                >
                  <Trophy className="w-5 h-5" />
                  <span className="font-medium">{t('nav.tournaments')}</span>
                </NavLink>
              </>
            )}
          </div>

          {user && (
            <>
              <div className="mt-6 mb-2 px-3">
                <span className="text-xs font-semibold text-dark-400 dark:text-dark-500 uppercase tracking-wider">
                  Fiok
                </span>
              </div>
              <div className="space-y-1">
                <NavLink
                  to="/inbox"
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                    location.pathname === '/inbox'
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                      : 'text-dark-600 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-700/50'
                  )}
                >
                  <Bell className="w-5 h-5" />
                  <span className="font-medium">{t('nav.inbox')}</span>
                  {unreadCount > 0 && (
                    <span className="ml-auto bg-error-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </NavLink>

                <NavLink
                  to="/profile"
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                    location.pathname === '/profile'
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                      : 'text-dark-600 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-700/50'
                  )}
                >
                  <User className="w-5 h-5" />
                  <span className="font-medium">{t('nav.profile')}</span>
                </NavLink>

                {isAdmin && (
                  <NavLink
                    to="/crm"
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                      location.pathname.startsWith('/crm')
                        ? 'bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400'
                        : 'text-dark-600 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-700/50'
                    )}
                  >
                    <Settings className="w-5 h-5" />
                    <span className="font-medium">{t('nav.crm')}</span>
                  </NavLink>
                )}
              </div>
            </>
          )}
        </div>

        {user && (
          <div className="p-4 border-t border-dark-200 dark:border-dark-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center text-white font-semibold">
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
