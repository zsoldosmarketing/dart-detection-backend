import { useState, useEffect } from 'react';
import { FileText, Search, Filter, Calendar, User, Shield, Settings, Trash2, CreditCard as Edit, Eye, LogIn, LogOut, CreditCard, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';

interface AuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
  status: 'success' | 'failure';
}

type ActionCategory = 'all' | 'auth' | 'data' | 'admin' | 'payment';

export function CRMAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [category, setCategory] = useState<ActionCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 20;

  useEffect(() => {
    fetchLogs();
  }, [category, page]);

  const fetchLogs = async () => {
    setIsLoading(true);

    const mockLogs: AuditLog[] = Array.from({ length: 50 }, (_, i) => {
      const actions = [
        { action: 'user.login', type: 'auth', resource: 'session' },
        { action: 'user.logout', type: 'auth', resource: 'session' },
        { action: 'user.register', type: 'auth', resource: 'user' },
        { action: 'user.password_reset', type: 'auth', resource: 'user' },
        { action: 'profile.update', type: 'data', resource: 'profile' },
        { action: 'game.create', type: 'data', resource: 'game' },
        { action: 'game.complete', type: 'data', resource: 'game' },
        { action: 'club.join', type: 'data', resource: 'club' },
        { action: 'club.leave', type: 'data', resource: 'club' },
        { action: 'tournament.register', type: 'data', resource: 'tournament' },
        { action: 'admin.user_ban', type: 'admin', resource: 'user' },
        { action: 'admin.config_update', type: 'admin', resource: 'config' },
        { action: 'admin.drill_create', type: 'admin', resource: 'drill' },
        { action: 'payment.subscription', type: 'payment', resource: 'subscription' },
        { action: 'payment.token_purchase', type: 'payment', resource: 'tokens' },
      ];
      const selected = actions[Math.floor(Math.random() * actions.length)];

      return {
        id: `log-${i}`,
        timestamp: new Date(Date.now() - i * 1000 * 60 * Math.random() * 60).toISOString(),
        user_id: `user-${Math.floor(Math.random() * 100)}`,
        user_email: `user${Math.floor(Math.random() * 100)}@example.com`,
        action: selected.action,
        resource_type: selected.resource,
        resource_id: `${selected.resource}-${Math.floor(Math.random() * 1000)}`,
        details: { old_value: 'x', new_value: 'y' },
        ip_address: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        status: Math.random() > 0.1 ? 'success' : 'failure',
      };
    });

    const filtered = category === 'all'
      ? mockLogs
      : mockLogs.filter((log) => {
          if (category === 'auth') return log.action.startsWith('user.');
          if (category === 'data') return ['profile', 'game', 'club', 'tournament'].some(t => log.action.includes(t));
          if (category === 'admin') return log.action.startsWith('admin.');
          if (category === 'payment') return log.action.startsWith('payment.');
          return true;
        });

    const start = (page - 1) * perPage;
    const paged = filtered.slice(start, start + perPage);

    setLogs(paged);
    setTotalPages(Math.ceil(filtered.length / perPage));
    setIsLoading(false);
  };

  const getActionIcon = (action: string) => {
    if (action.includes('login')) return <LogIn className="w-4 h-4" />;
    if (action.includes('logout')) return <LogOut className="w-4 h-4" />;
    if (action.includes('delete') || action.includes('ban')) return <Trash2 className="w-4 h-4" />;
    if (action.includes('update') || action.includes('edit')) return <Edit className="w-4 h-4" />;
    if (action.includes('create') || action.includes('register')) return <User className="w-4 h-4" />;
    if (action.includes('payment') || action.includes('subscription')) return <CreditCard className="w-4 h-4" />;
    if (action.includes('admin') || action.includes('config')) return <Shield className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const getActionColor = (action: string): string => {
    if (action.includes('delete') || action.includes('ban')) return 'text-red-500';
    if (action.includes('create') || action.includes('register')) return 'text-green-500';
    if (action.includes('update') || action.includes('edit')) return 'text-amber-500';
    if (action.includes('login') || action.includes('logout')) return 'text-blue-500';
    if (action.includes('payment')) return 'text-primary-500';
    return 'text-dark-500';
  };

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'User', 'Action', 'Resource', 'Status', 'IP Address'].join(','),
      ...logs.map((log) =>
        [
          log.timestamp,
          log.user_email,
          log.action,
          `${log.resource_type}:${log.resource_id}`,
          log.status,
          log.ip_address,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">
            Audit Naplo
          </h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            Rendszertevékenységek és felhasználói műveletek nyomon követése
          </p>
        </div>
        <Button
          variant="outline"
          leftIcon={<Download className="w-4 h-4" />}
          onClick={exportLogs}
        >
          Exportalas
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(['all', 'auth', 'data', 'admin', 'payment'] as ActionCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => { setCategory(cat); setPage(1); }}
            className={`p-3 rounded-xl border-2 transition-all ${
              category === cat
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-dark-200 dark:border-dark-700 hover:border-dark-300 dark:hover:border-dark-600'
            }`}
          >
            <div className={`w-8 h-8 mx-auto mb-2 rounded-lg flex items-center justify-center ${
              category === cat ? 'bg-primary-100 dark:bg-primary-900/50' : 'bg-dark-100 dark:bg-dark-700'
            }`}>
              {cat === 'all' && <FileText className={`w-4 h-4 ${category === cat ? 'text-primary-600' : 'text-dark-500'}`} />}
              {cat === 'auth' && <LogIn className={`w-4 h-4 ${category === cat ? 'text-primary-600' : 'text-dark-500'}`} />}
              {cat === 'data' && <Edit className={`w-4 h-4 ${category === cat ? 'text-primary-600' : 'text-dark-500'}`} />}
              {cat === 'admin' && <Shield className={`w-4 h-4 ${category === cat ? 'text-primary-600' : 'text-dark-500'}`} />}
              {cat === 'payment' && <CreditCard className={`w-4 h-4 ${category === cat ? 'text-primary-600' : 'text-dark-500'}`} />}
            </div>
            <span className={`text-sm font-medium ${
              category === cat ? 'text-primary-600' : 'text-dark-700 dark:text-dark-300'
            }`}>
              {cat === 'all' && 'Összes'}
              {cat === 'auth' && 'Azonosítás'}
              {cat === 'data' && 'Adatok'}
              {cat === 'admin' && 'Admin'}
              {cat === 'payment' && 'Fizetés'}
            </span>
          </button>
        ))}
      </div>

      <Card>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Input
              placeholder="Keresés felhasználó, esemény..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="px-3 py-2 bg-white dark:bg-dark-800 border border-dark-300 dark:border-dark-600 rounded-lg text-sm"
            />
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="px-3 py-2 bg-white dark:bg-dark-800 border border-dark-300 dark:border-dark-600 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-200 dark:border-dark-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-dark-500">Időpont</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-dark-500">Felhasználó</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-dark-500">Esemény</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-dark-500">Erőforrás</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-dark-500">Statusz</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-dark-500">IP</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-dark-500"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-dark-100 dark:border-dark-800 hover:bg-dark-50 dark:hover:bg-dark-800/50"
                >
                  <td className="py-3 px-4">
                    <div className="text-sm text-dark-900 dark:text-white">
                      {format(new Date(log.timestamp), 'MMM d, HH:mm:ss', { locale: hu })}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-dark-900 dark:text-white truncate max-w-[150px]">
                      {log.user_email}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className={`flex items-center gap-2 ${getActionColor(log.action)}`}>
                      {getActionIcon(log.action)}
                      <span className="text-sm font-medium">{log.action}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-dark-600 dark:text-dark-400">
                      {log.resource_type}
                      {log.resource_id && (
                        <span className="text-dark-400">:{log.resource_id.slice(0, 8)}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={log.status === 'success' ? 'success' : 'error'} size="sm">
                      {log.status === 'success' ? 'OK' : 'Hiba'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-dark-500 font-mono">{log.ip_address}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-dark-200 dark:border-dark-700">
          <p className="text-sm text-dark-500">
            {page}. oldal / {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ChevronLeft className="w-4 h-4" />}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Elozo
            </Button>
            <Button
              variant="outline"
              size="sm"
              rightIcon={<ChevronRight className="w-4 h-4" />}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Kovetkezo
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
