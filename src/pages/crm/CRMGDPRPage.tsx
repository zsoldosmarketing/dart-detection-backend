import { useState, useEffect } from 'react';
import {
  Shield,
  Download,
  Trash2,
  Search,
  User,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Eye,
  Mail,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';

interface DataRequest {
  id: string;
  user_id: string;
  user_email: string;
  request_type: 'export' | 'delete' | 'rectification';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requested_at: string;
  completed_at: string | null;
  notes: string | null;
}

interface ConsentRecord {
  id: string;
  user_email: string;
  consent_type: string;
  granted: boolean;
  timestamp: string;
  ip_address: string;
}

type Tab = 'requests' | 'consents' | 'export';

export function CRMGDPRPage() {
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [exportEmail, setExportEmail] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);

    if (activeTab === 'requests') {
      const mockRequests: DataRequest[] = [
        {
          id: '1',
          user_id: 'user-1',
          user_email: 'felhasznalo1@example.com',
          request_type: 'export',
          status: 'completed',
          requested_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          completed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          notes: null,
        },
        {
          id: '2',
          user_id: 'user-2',
          user_email: 'felhasznalo2@example.com',
          request_type: 'delete',
          status: 'pending',
          requested_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          completed_at: null,
          notes: null,
        },
        {
          id: '3',
          user_id: 'user-3',
          user_email: 'felhasznalo3@example.com',
          request_type: 'rectification',
          status: 'processing',
          requested_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          completed_at: null,
          notes: 'Nev modositas kerelme',
        },
      ];
      setRequests(mockRequests);
    } else if (activeTab === 'consents') {
      const mockConsents: ConsentRecord[] = [
        {
          id: '1',
          user_email: 'felhasznalo1@example.com',
          consent_type: 'marketing',
          granted: true,
          timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          ip_address: '192.168.1.1',
        },
        {
          id: '2',
          user_email: 'felhasznalo1@example.com',
          consent_type: 'analytics',
          granted: true,
          timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          ip_address: '192.168.1.1',
        },
        {
          id: '3',
          user_email: 'felhasznalo2@example.com',
          consent_type: 'marketing',
          granted: false,
          timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          ip_address: '192.168.1.2',
        },
        {
          id: '4',
          user_email: 'felhasznalo3@example.com',
          consent_type: 'marketing',
          granted: true,
          timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          ip_address: '192.168.1.3',
        },
      ];
      setConsents(mockConsents);
    }

    setIsLoading(false);
  };

  const handleExportUserData = async () => {
    if (!exportEmail) return;
    setIsExporting(true);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const userData = {
      email: exportEmail,
      exportedAt: new Date().toISOString(),
      profile: {
        display_name: 'Teszt Felhasznalo',
        created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
      games: [
        { id: 1, date: '2024-01-15', score: 180 },
        { id: 2, date: '2024-01-16', score: 140 },
      ],
      statistics: {
        total_games: 150,
        average_score: 45.5,
        best_checkout: 167,
      },
    };

    const blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user-data-${exportEmail.split('@')[0]}-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setIsExporting(false);
    setExportEmail('');
  };

  const handleProcessRequest = async (requestId: string, action: 'approve' | 'reject') => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: action === 'approve' ? 'processing' : 'rejected',
            }
          : r
      )
    );
  };

  const getRequestTypeBadge = (type: DataRequest['request_type']) => {
    switch (type) {
      case 'export':
        return <Badge variant="primary">Export</Badge>;
      case 'delete':
        return <Badge variant="error">Torles</Badge>;
      case 'rectification':
        return <Badge variant="warning">Modositas</Badge>;
    }
  };

  const getStatusBadge = (status: DataRequest['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Fuggo</Badge>;
      case 'processing':
        return <Badge variant="primary">Folyamatban</Badge>;
      case 'completed':
        return <Badge variant="success">Befejezve</Badge>;
      case 'rejected':
        return <Badge variant="error">Elutasitva</Badge>;
    }
  };

  const stats = {
    pendingRequests: requests.filter((r) => r.status === 'pending').length,
    completedRequests: requests.filter((r) => r.status === 'completed').length,
    totalConsents: consents.filter((c) => c.granted).length,
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
            GDPR Kezelés
          </h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            Adatvedelmi kerelmek es hozzajarulasok kezelese
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-dark-500">Fuggo kerelmek</p>
              <p className="text-xl font-bold text-dark-900 dark:text-white">
                {stats.pendingRequests}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-dark-500">Teljesitett</p>
              <p className="text-xl font-bold text-dark-900 dark:text-white">
                {stats.completedRequests}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <Shield className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-dark-500">Aktiv hozzajarulasok</p>
              <p className="text-xl font-bold text-dark-900 dark:text-white">
                {stats.totalConsents}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex gap-2 border-b border-dark-200 dark:border-dark-700">
        {(['requests', 'consents', 'export'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-dark-500 hover:text-dark-700 dark:hover:text-dark-300'
            }`}
          >
            {tab === 'requests' && 'Adatkerelmek'}
            {tab === 'consents' && 'Hozzajarulasok'}
            {tab === 'export' && 'Adat export'}
          </button>
        ))}
      </div>

      {activeTab === 'requests' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white">
              Adatkerelmek
            </h3>
            <Input
              placeholder="Kereses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              className="w-64"
            />
          </div>

          {requests.length === 0 ? (
            <div className="text-center py-12 text-dark-500">
              Nincs adatkérelem
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-dark-200 dark:border-dark-700"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-dark-100 dark:bg-dark-700 rounded-lg">
                      {request.request_type === 'export' && <Download className="w-5 h-5 text-dark-500" />}
                      {request.request_type === 'delete' && <Trash2 className="w-5 h-5 text-red-500" />}
                      {request.request_type === 'rectification' && <FileText className="w-5 h-5 text-amber-500" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-dark-900 dark:text-white">
                          {request.user_email}
                        </span>
                        {getRequestTypeBadge(request.request_type)}
                        {getStatusBadge(request.status)}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-dark-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(request.requested_at), 'yyyy.MM.dd HH:mm', { locale: hu })}
                        </span>
                        {request.notes && (
                          <span className="text-dark-400">| {request.notes}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {request.status === 'pending' && (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleProcessRequest(request.id, 'approve')}
                        >
                          Jovahagyas
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleProcessRequest(request.id, 'reject')}
                        >
                          Elutasitas
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'consents' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white">
              Hozzajarulasok nyilvantartasa
            </h3>
            <Input
              placeholder="Kereses email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              className="w-64"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-200 dark:border-dark-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-dark-500">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-dark-500">Tipus</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-dark-500">Allapot</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-dark-500">Datum</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-dark-500">IP</th>
                </tr>
              </thead>
              <tbody>
                {consents.map((consent) => (
                  <tr
                    key={consent.id}
                    className="border-b border-dark-100 dark:border-dark-800"
                  >
                    <td className="py-3 px-4 text-sm text-dark-900 dark:text-white">
                      {consent.user_email}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary">{consent.consent_type}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      {consent.granted ? (
                        <Badge variant="success">Elfogadva</Badge>
                      ) : (
                        <Badge variant="error">Elutasitva</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-dark-500">
                      {format(new Date(consent.timestamp), 'yyyy.MM.dd HH:mm', { locale: hu })}
                    </td>
                    <td className="py-3 px-4 text-sm text-dark-500 font-mono">
                      {consent.ip_address}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'export' && (
        <div className="grid gap-6">
          <Card>
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
              Felhasznaloi adatok exportalasa
            </h3>
            <p className="text-dark-500 dark:text-dark-400 mb-4">
              Add meg a felhasznalo email cimet, akinek az adatait exportalni szeretned.
              Az export tartalmazza az osszes szemelyes adatot a GDPR eloirasainak megfeleloen.
            </p>

            <div className="flex gap-3">
              <Input
                placeholder="felhasznalo@example.com"
                value={exportEmail}
                onChange={(e) => setExportEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                className="flex-1"
              />
              <Button
                variant="primary"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={handleExportUserData}
                isLoading={isExporting}
                disabled={!exportEmail}
              >
                Exportalas
              </Button>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
              Export tartalma
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { icon: User, title: 'Profil adatok', desc: 'Nev, email, regisztracio datuma' },
                { icon: FileText, title: 'Jatek elozmenyek', desc: 'Minden jatekszam es eredmeny' },
                { icon: Shield, title: 'Hozzajarulasok', desc: 'Marketing, analytics engedelyek' },
                { icon: Clock, title: 'Aktivitas naplo', desc: 'Bejelentkezesek, muveletek' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-dark-50 dark:bg-dark-800">
                  <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                    <item.icon className="w-4 h-4 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-medium text-dark-900 dark:text-white">{item.title}</p>
                    <p className="text-sm text-dark-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800 dark:text-amber-200">
                  Figyelmeztetés
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Az adatexport bizalmas informaciokat tartalmaz. Gyozodj meg rola, hogy a
                  megfele8 szemelynek kulod el, es biztonsagos csatornat hasznalsz a tovabbitashoz.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
