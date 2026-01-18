import { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  MoreVertical,
  Shield,
  Mail,
  Calendar,
  Target,
  Trophy,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import clsx from 'clsx';

interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  skill_rating: number;
  is_admin: boolean;
  total_games_played: number;
  total_wins: number;
  current_streak: number;
  last_active_at: string | null;
  created_at: string;
}

export function CRMUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'admin' | 'active'>('all');
  const pageSize = 20;

  useEffect(() => {
    fetchUsers();
  }, [page, filter]);

  const fetchUsers = async () => {
    setIsLoading(true);

    let query = supabase
      .from('user_profile')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (filter === 'admin') {
      query = query.eq('is_admin', true);
    } else if (filter === 'active') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte('last_active_at', weekAgo.toISOString());
    }

    const { data, count } = await query;

    setUsers(data || []);
    setTotalCount(count || 0);
    setIsLoading(false);
  };

  const searchUsers = async () => {
    if (!search.trim()) {
      fetchUsers();
      return;
    }

    setIsLoading(true);

    const { data, count } = await supabase
      .from('user_profile')
      .select('*', { count: 'exact' })
      .or(`username.ilike.%${search}%,display_name.ilike.%${search}%`)
      .order('created_at', { ascending: false })
      .limit(pageSize);

    setUsers(data || []);
    setTotalCount(count || 0);
    setIsLoading(false);
  };

  const toggleAdmin = async (userId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('user_profile')
      .update({ is_admin: !currentStatus })
      .eq('id', userId);

    if (!error) {
      setUsers(users.map(u =>
        u.id === userId ? { ...u, is_admin: !currentStatus } : u
      ));
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Felhasznalok</h1>
          <p className="text-dark-500">{totalCount} regisztralt felhasznalo</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 flex gap-2">
          <Input
            placeholder="Kereses nev vagy email alapjan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
            className="flex-1"
          />
          <Button onClick={searchUsers}>
            <Search className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          {(['all', 'admin', 'active'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(0); }}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                filter === f
                  ? 'bg-primary-500 text-white'
                  : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-300'
              )}
            >
              {f === 'all' ? 'Mind' : f === 'admin' ? 'Admin' : 'Aktiv'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dark-50 dark:bg-dark-800 border-b border-dark-200 dark:border-dark-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wider">
                      Felhasznalo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wider">
                      Statisztika
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wider">
                      Skill
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wider">
                      Regisztracio
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dark-500 uppercase tracking-wider">
                      Szerepkor
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-dark-500 uppercase tracking-wider">
                      Muveletek
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-200 dark:divide-dark-700">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-dark-50 dark:hover:bg-dark-800/50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center text-white font-semibold">
                            {(user.display_name || user.username || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-dark-900 dark:text-white">
                              {user.display_name || user.username || 'Nincs nev'}
                            </p>
                            <p className="text-sm text-dark-500">@{user.username || 'n/a'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1 text-dark-600 dark:text-dark-400">
                            <Target className="w-4 h-4" />
                            {user.total_games_played}
                          </span>
                          <span className="flex items-center gap-1 text-dark-600 dark:text-dark-400">
                            <Trophy className="w-4 h-4" />
                            {user.total_wins}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-medium text-dark-900 dark:text-white">
                          {user.skill_rating?.toFixed(1) || '5.0'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-dark-500">
                        {format(new Date(user.created_at), 'yyyy.MM.dd', { locale: hu })}
                      </td>
                      <td className="px-4 py-4">
                        {user.is_admin ? (
                          <Badge variant="primary" className="flex items-center gap-1 w-fit">
                            <Shield className="w-3 h-3" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge>User</Badge>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleAdmin(user.id, user.is_admin)}
                        >
                          {user.is_admin ? 'Elvesz admin' : 'Admin jog'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-dark-500">
                {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalCount)} / {totalCount}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
