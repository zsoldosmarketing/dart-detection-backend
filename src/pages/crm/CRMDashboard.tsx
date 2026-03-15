import { useState, useEffect } from 'react';
import {
  Users,
  Gamepad2,
  Trophy,
  Bell,
  TrendingUp,
  Activity,
  Target,
  Award,
} from 'lucide-react';
import { Card, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { supabase } from '../../lib/supabase';

interface DashboardStats {
  totalUsers: number;
  activeToday: number;
  totalGames: number;
  totalClubs: number;
  totalTournaments: number;
  pendingNotifications: number;
}

export function CRMDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeToday: 0,
    totalGames: 0,
    totalClubs: 0,
    totalTournaments: 0,
    pendingNotifications: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    const [usersRes, gamesRes, clubsRes, tournamentsRes, notifRes] = await Promise.all([
      supabase.from('user_profile').select('id', { count: 'exact', head: true }),
      supabase.from('game_rooms').select('id', { count: 'exact', head: true }),
      supabase.from('clubs').select('id', { count: 'exact', head: true }),
      supabase.from('tournaments').select('id', { count: 'exact', head: true }),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
    ]);

    setStats({
      totalUsers: usersRes.count || 0,
      activeToday: 0,
      totalGames: gamesRes.count || 0,
      totalClubs: clubsRes.count || 0,
      totalTournaments: tournamentsRes.count || 0,
      pendingNotifications: notifRes.count || 0,
    });

    setIsLoading(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-dark-900 dark:text-white">CRM Dashboard</h1>
        <p className="text-dark-500 dark:text-dark-400 mt-1">
          Platform attekintes es statisztikak
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Összes felhasználó"
          value={stats.totalUsers}
          color="primary"
        />
        <StatCard
          icon={<Gamepad2 className="w-5 h-5" />}
          label="Összes játék"
          value={stats.totalGames}
          color="secondary"
        />
        <StatCard
          icon={<Target className="w-5 h-5" />}
          label="Klubok"
          value={stats.totalClubs}
          color="accent"
        />
        <StatCard
          icon={<Trophy className="w-5 h-5" />}
          label="Tornák"
          value={stats.totalTournaments}
          color="success"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>Legutóbbi aktivitás</CardTitle>
          <div className="mt-4 text-dark-500 dark:text-dark-400 text-sm">
            Az aktivitás napló hamarosan elérhető lesz.
          </div>
        </Card>

        <Card>
          <CardTitle>Rendszer állapot</CardTitle>
          <div className="mt-4 space-y-3">
            <StatusRow label="Adatbázis" status="operational" />
            <StatusRow label="Auth szolgáltatás" status="operational" />
            <StatusRow label="Realtime" status="operational" />
            <StatusRow label="Edge Functions" status="operational" />
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Gyors műveletek</CardTitle>
        <div className="mt-4 grid sm:grid-cols-3 gap-4">
          <QuickAction
            icon={<Bell className="w-5 h-5" />}
            title="Új push kampány"
            to="/crm/push"
          />
          <QuickAction
            icon={<Target className="w-5 h-5" />}
            title="Drill hozzáadása"
            to="/crm/drills"
          />
          <QuickAction
            icon={<Activity className="w-5 h-5" />}
            title="Audit napló"
            to="/crm/audit"
          />
        </div>
      </Card>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'primary' | 'secondary' | 'accent' | 'success';
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const colors = {
    primary: 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400',
    secondary: 'bg-secondary-50 dark:bg-secondary-900/20 text-secondary-600 dark:text-secondary-400',
    accent: 'bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400',
    success: 'bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400',
  };

  return (
    <Card className="relative">
      <div className={`absolute top-4 right-4 p-2 rounded-lg ${colors[color]}`}>{icon}</div>
      <p className="text-sm text-dark-500 dark:text-dark-400">{label}</p>
      <p className="text-3xl font-bold text-dark-900 dark:text-white mt-1">{value}</p>
    </Card>
  );
}

interface StatusRowProps {
  label: string;
  status: 'operational' | 'degraded' | 'down';
}

function StatusRow({ label, status }: StatusRowProps) {
  const statusColors = {
    operational: 'bg-success-500',
    degraded: 'bg-warning-500',
    down: 'bg-error-500',
  };

  const statusLabels = {
    operational: 'Mukodokepes',
    degraded: 'Korltozottan elerheto',
    down: 'Leallva',
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-dark-700 dark:text-dark-300">{label}</span>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
        <span className="text-sm text-dark-500">{statusLabels[status]}</span>
      </div>
    </div>
  );
}

interface QuickActionProps {
  icon: React.ReactNode;
  title: string;
  to: string;
}

function QuickAction({ icon, title, to }: QuickActionProps) {
  return (
    <a
      href={to}
      className="flex items-center gap-3 p-4 rounded-lg bg-dark-50 dark:bg-dark-700/50 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
    >
      <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
        {icon}
      </div>
      <span className="font-medium text-dark-900 dark:text-white">{title}</span>
    </a>
  );
}
