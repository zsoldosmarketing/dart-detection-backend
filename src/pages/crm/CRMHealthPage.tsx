import { useState, useEffect } from 'react';
import {
  Activity,
  Server,
  Database,
  Globe,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Cpu,
  HardDrive,
  Wifi,
  Zap,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  uptime: number;
  lastCheck: string;
  message?: string;
}

interface SystemMetric {
  name: string;
  value: number;
  max: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
}

interface RecentIncident {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  startedAt: string;
  resolvedAt: string | null;
}

export function CRMHealthPage() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);
  const [incidents, setIncidents] = useState<RecentIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchHealthData();
    const interval = setInterval(fetchHealthData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchHealthData = async () => {
    setIsLoading(true);

    const mockServices: ServiceStatus[] = [
      {
        name: 'API Server',
        status: 'healthy',
        latency: 45,
        uptime: 99.98,
        lastCheck: new Date().toISOString(),
      },
      {
        name: 'Database',
        status: 'healthy',
        latency: 12,
        uptime: 99.99,
        lastCheck: new Date().toISOString(),
      },
      {
        name: 'Authentication',
        status: 'healthy',
        latency: 38,
        uptime: 99.95,
        lastCheck: new Date().toISOString(),
      },
      {
        name: 'Real-time',
        status: 'degraded',
        latency: 150,
        uptime: 98.5,
        lastCheck: new Date().toISOString(),
        message: 'Elevated latency detected',
      },
      {
        name: 'Storage',
        status: 'healthy',
        latency: 25,
        uptime: 99.99,
        lastCheck: new Date().toISOString(),
      },
      {
        name: 'Edge Functions',
        status: 'healthy',
        latency: 89,
        uptime: 99.9,
        lastCheck: new Date().toISOString(),
      },
    ];

    const mockMetrics: SystemMetric[] = [
      { name: 'CPU hasznalat', value: 34, max: 100, unit: '%', trend: 'stable' },
      { name: 'Memoria', value: 2.4, max: 4, unit: 'GB', trend: 'up' },
      { name: 'Tarolo', value: 45, max: 100, unit: 'GB', trend: 'up' },
      { name: 'Aktiv kapcsolatok', value: 127, max: 500, unit: '', trend: 'down' },
      { name: 'Keresek/mp', value: 245, max: 1000, unit: 'req/s', trend: 'stable' },
      { name: 'Atlagos valaszido', value: 48, max: 200, unit: 'ms', trend: 'stable' },
    ];

    const mockIncidents: RecentIncident[] = [
      {
        id: '1',
        title: 'Real-time szolgaltatas lassulas',
        severity: 'medium',
        status: 'monitoring',
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        resolvedAt: null,
      },
      {
        id: '2',
        title: 'Database kapcsolati hiba',
        severity: 'high',
        status: 'resolved',
        startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        resolvedAt: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '3',
        title: 'API rate limit tullepes',
        severity: 'low',
        status: 'resolved',
        startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        resolvedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
      },
    ];

    setServices(mockServices);
    setMetrics(mockMetrics);
    setIncidents(mockIncidents);
    setLastRefresh(new Date());
    setIsLoading(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchHealthData();
    setIsRefreshing(false);
  };

  const getStatusIcon = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'down':
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-amber-500';
      case 'down':
        return 'bg-red-500';
    }
  };

  const getSeverityBadge = (severity: RecentIncident['severity']) => {
    switch (severity) {
      case 'low':
        return <Badge variant="default">Alacsony</Badge>;
      case 'medium':
        return <Badge variant="warning">Kozepes</Badge>;
      case 'high':
        return <Badge variant="error">Magas</Badge>;
      case 'critical':
        return <Badge variant="error">Kritikus</Badge>;
    }
  };

  const getIncidentStatusBadge = (status: RecentIncident['status']) => {
    switch (status) {
      case 'investigating':
        return <Badge variant="error">Vizsgalat</Badge>;
      case 'identified':
        return <Badge variant="warning">Azonositva</Badge>;
      case 'monitoring':
        return <Badge variant="primary">Megfigyeles</Badge>;
      case 'resolved':
        return <Badge variant="success">Megoldva</Badge>;
    }
  };

  const overallStatus = services.some((s) => s.status === 'down')
    ? 'down'
    : services.some((s) => s.status === 'degraded')
    ? 'degraded'
    : 'healthy';

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
            Rendszer allapot
          </h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            Utolso frissites: {format(lastRefresh, 'HH:mm:ss', { locale: hu })}
          </p>
        </div>
        <Button
          variant="outline"
          leftIcon={<RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          Frissites
        </Button>
      </div>

      <Card
        className={`${
          overallStatus === 'healthy'
            ? 'bg-gradient-to-r from-green-500 to-green-600'
            : overallStatus === 'degraded'
            ? 'bg-gradient-to-r from-amber-500 to-amber-600'
            : 'bg-gradient-to-r from-red-500 to-red-600'
        } text-white`}
      >
        <div className="flex items-center gap-4">
          <div className="p-4 bg-white/20 rounded-xl">
            {overallStatus === 'healthy' ? (
              <CheckCircle className="w-8 h-8" />
            ) : overallStatus === 'degraded' ? (
              <AlertTriangle className="w-8 h-8" />
            ) : (
              <XCircle className="w-8 h-8" />
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold">
              {overallStatus === 'healthy' && 'Minden rendszer mukodik'}
              {overallStatus === 'degraded' && 'Reszleges szolgaltatas keses'}
              {overallStatus === 'down' && 'Rendszerhiba'}
            </h2>
            <p className="opacity-90">
              {services.filter((s) => s.status === 'healthy').length} / {services.length} szolgaltatas elerheto
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
            <Server className="w-5 h-5" />
            Szolgaltatasok
          </h3>
          <div className="space-y-3">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-3 rounded-lg bg-dark-50 dark:bg-dark-800"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(service.status)}
                  <div>
                    <p className="font-medium text-dark-900 dark:text-white">{service.name}</p>
                    {service.message && (
                      <p className="text-sm text-amber-600">{service.message}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-dark-900 dark:text-white">
                    {service.latency}ms
                  </p>
                  <p className="text-xs text-dark-500">{service.uptime}% uptime</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Rendszer metrikak
          </h3>
          <div className="space-y-4">
            {metrics.map((metric) => (
              <div key={metric.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-dark-600 dark:text-dark-400">{metric.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-dark-900 dark:text-white">
                      {metric.value} {metric.unit}
                    </span>
                    {metric.trend === 'up' && <TrendingUp className="w-4 h-4 text-amber-500" />}
                    {metric.trend === 'down' && <TrendingDown className="w-4 h-4 text-green-500" />}
                  </div>
                </div>
                <div className="h-2 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      metric.value / metric.max > 0.8
                        ? 'bg-red-500'
                        : metric.value / metric.max > 0.6
                        ? 'bg-amber-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${(metric.value / metric.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Korabbi incidensek
        </h3>
        {incidents.length === 0 ? (
          <div className="text-center py-8 text-dark-500">
            Nincs incidens az elmult 30 napban
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((incident) => (
              <div
                key={incident.id}
                className="flex items-center justify-between p-4 rounded-lg border border-dark-200 dark:border-dark-700"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-dark-900 dark:text-white">
                      {incident.title}
                    </h4>
                    {getSeverityBadge(incident.severity)}
                    {getIncidentStatusBadge(incident.status)}
                  </div>
                  <p className="text-sm text-dark-500">
                    Kezdet: {format(new Date(incident.startedAt), 'MMM d, HH:mm', { locale: hu })}
                    {incident.resolvedAt && (
                      <> | Megoldva: {format(new Date(incident.resolvedAt), 'MMM d, HH:mm', { locale: hu })}</>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm" className="text-center">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg w-fit mx-auto mb-2">
            <Globe className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-dark-900 dark:text-white">99.9%</p>
          <p className="text-sm text-dark-500">Uptime (30 nap)</p>
        </Card>

        <Card padding="sm" className="text-center">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg w-fit mx-auto mb-2">
            <Zap className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-dark-900 dark:text-white">48ms</p>
          <p className="text-sm text-dark-500">Atlag valaszido</p>
        </Card>

        <Card padding="sm" className="text-center">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg w-fit mx-auto mb-2">
            <Wifi className="w-5 h-5 text-primary-600" />
          </div>
          <p className="text-2xl font-bold text-dark-900 dark:text-white">127</p>
          <p className="text-sm text-dark-500">Aktiv kapcsolatok</p>
        </Card>

        <Card padding="sm" className="text-center">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg w-fit mx-auto mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-dark-900 dark:text-white">2</p>
          <p className="text-sm text-dark-500">Incidensek (30 nap)</p>
        </Card>
      </div>
    </div>
  );
}
