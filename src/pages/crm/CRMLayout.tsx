import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Bell,
  Users,
  Target,
  BookOpen,
  Trophy as TrophyIcon,
  Users as ClubIcon,
  Settings,
  FileText,
  Activity,
  Shield,
  Sparkles,
} from 'lucide-react';
import clsx from 'clsx';
import { t } from '../../lib/i18n';

const crmNavItems = [
  { path: '/crm', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/crm/push', label: t('crm.push'), icon: Bell },
  { path: '/crm/users', label: t('crm.users'), icon: Users },
  { path: '/crm/drills', label: t('crm.drills'), icon: Target },
  { path: '/crm/programs', label: t('crm.programs'), icon: BookOpen },
  { path: '/crm/clubs', label: t('crm.clubs'), icon: ClubIcon },
  { path: '/crm/tournaments', label: t('crm.tournaments'), icon: TrophyIcon },
  { path: '/crm/config', label: t('crm.config'), icon: Settings },
  { path: '/crm/audit', label: t('crm.audit'), icon: FileText },
  { path: '/crm/health', label: t('crm.health'), icon: Activity },
  { path: '/crm/gdpr', label: t('crm.gdpr'), icon: Shield },
  { path: '/crm/ai', label: 'AI Edző', icon: Sparkles },
];

export function CRMLayout() {
  return (
    <div className="min-h-screen">
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-1 p-1 bg-dark-100 dark:bg-dark-800 rounded-xl min-w-max">
          {crmNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                    isActive
                      ? 'bg-white dark:bg-dark-700 text-dark-900 dark:text-white shadow-sm'
                      : 'text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-300'
                  )
                }
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </div>

      <Outlet />
    </div>
  );
}
