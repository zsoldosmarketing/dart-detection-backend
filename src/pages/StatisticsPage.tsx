import { useState, useEffect } from 'react';
import {
  BarChart3,
  Target,
  Trophy,
  TrendingUp,
  Flame,
  Crosshair,
  Circle,
  Percent,
  Download,
  FileText,
  FileJson,
  Printer,
  Zap,
  Award,
  Users,
  Bot,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { hu } from 'date-fns/locale';
import { exportAsCSV, exportAsJSON, printReport, type ExportData } from '../lib/exportUtils';
import { t } from '../lib/i18n';

interface MatchStats {
  id: string;
  player_id: string;
  room_id: string;
  opponent_id: string | null;
  game_type: string;
  game_mode: string;
  won: boolean;
  match_average: number;
  best_leg_average: number;
  worst_leg_average: number;
  total_doubles_hit: number;
  total_doubles_thrown: number;
  total_triples_hit: number;
  total_triples_thrown: number;
  checkouts_hit: number;
  checkout_attempts: number;
  highest_checkout: number;
  duration_seconds: number;
  legs_won: number;
  legs_lost: number;
  created_at: string;
}

interface LegStats {
  id: string;
  player_id: string;
  room_id: string;
  game_type: string;
  won: boolean;
  three_dart_average: number;
  first_nine_average: number;
  visits_180: number;
  visits_171_179: number;
  visits_160_170: number;
  visits_140_159: number;
  visits_120_139: number;
  visits_100_119: number;
  doubles_hit: number;
  doubles_thrown: number;
  triples_hit: number;
  triples_thrown: number;
  sector_hits: Record<string, number>;
  created_at: string;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
}

function StatCard({ icon, label, value, subValue, color }: StatCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-dark-900 dark:text-white">{value}</p>
        <p className="text-sm text-dark-500">{label}</p>
        {subValue && <p className="text-xs text-dark-400 mt-1">{subValue}</p>}
      </div>
    </Card>
  );
}

export function StatisticsPage() {
  const { user, profile } = useAuthStore();
  const [matchStats, setMatchStats] = useState<MatchStats[]>([]);
  const [legStats, setLegStats] = useState<LegStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    if (user) {
      fetchStatistics();
    }
  }, [user, period]);

  const fetchStatistics = async () => {
    if (!user) return;

    setIsLoading(true);

    let fromDate: Date;
    switch (period) {
      case 'week':
        fromDate = subDays(new Date(), 7);
        break;
      case 'month':
        fromDate = subDays(new Date(), 30);
        break;
      default:
        fromDate = subDays(new Date(), 365);
    }

    const [matchRes, legRes] = await Promise.all([
      supabase
        .from('match_statistics')
        .select('*')
        .eq('player_id', user.id)
        .gte('created_at', fromDate.toISOString())
        .order('created_at', { ascending: false }),
      supabase
        .from('leg_statistics')
        .select('*')
        .eq('player_id', user.id)
        .gte('created_at', fromDate.toISOString())
        .order('created_at', { ascending: false }),
    ]);

    setMatchStats(matchRes.data || []);
    setLegStats(legRes.data || []);
    setIsLoading(false);
  };

  const calculateAggregates = () => {
    const botMatches = matchStats.filter(m => m.game_mode === 'bot');
    const pvpMatches = matchStats.filter(m => m.game_mode === 'pvp');

    const avgMatchAverage = matchStats.length > 0
      ? matchStats.reduce((sum, m) => sum + (m.match_average || 0), 0) / matchStats.length
      : 0;

    const avgFirstNine = legStats.length > 0
      ? legStats.reduce((sum, l) => sum + (l.first_nine_average || 0), 0) / legStats.length
      : 0;

    const total180s = legStats.reduce((sum, l) => sum + (l.visits_180 || 0), 0);
    const total140Plus = legStats.reduce((sum, l) =>
      sum + (l.visits_140_159 || 0) + (l.visits_160_170 || 0) + (l.visits_171_179 || 0) + (l.visits_180 || 0), 0);
    const total100Plus = legStats.reduce((sum, l) =>
      sum + (l.visits_100_119 || 0) + (l.visits_120_139 || 0) + (l.visits_140_159 || 0) +
      (l.visits_160_170 || 0) + (l.visits_171_179 || 0) + (l.visits_180 || 0), 0);

    const totalDoublesThrown = matchStats.reduce((sum, m) => sum + (m.total_doubles_thrown || 0), 0);
    const totalDoublesHit = matchStats.reduce((sum, m) => sum + (m.total_doubles_hit || 0), 0);
    const totalTriplesThrown = matchStats.reduce((sum, m) => sum + (m.total_triples_thrown || 0), 0);
    const totalTriplesHit = matchStats.reduce((sum, m) => sum + (m.total_triples_hit || 0), 0);

    const totalCheckoutAttempts = matchStats.reduce((sum, m) => sum + (m.checkout_attempts || 0), 0);
    const totalCheckoutsHit = matchStats.reduce((sum, m) => sum + (m.checkouts_hit || 0), 0);
    const highestCheckout = matchStats.reduce((max, m) => Math.max(max, m.highest_checkout || 0), 0);

    const gamesWon = matchStats.filter(m => m.won).length;
    const gamesPlayed = matchStats.length;

    const botWins = botMatches.filter(m => m.won).length;
    const botGames = botMatches.length;
    const pvpWins = pvpMatches.filter(m => m.won).length;
    const pvpGames = pvpMatches.length;

    const botAverage = botMatches.length > 0
      ? botMatches.reduce((sum, m) => sum + (m.match_average || 0), 0) / botMatches.length
      : 0;
    const pvpAverage = pvpMatches.length > 0
      ? pvpMatches.reduce((sum, m) => sum + (m.match_average || 0), 0) / pvpMatches.length
      : 0;

    const sectorHits: Record<string, number> = {};
    legStats.forEach(leg => {
      if (leg.sector_hits) {
        Object.entries(leg.sector_hits).forEach(([sector, hits]) => {
          sectorHits[sector] = (sectorHits[sector] || 0) + (hits as number);
        });
      }
    });

    const bestLegAverage = legStats.reduce((max, l) => Math.max(max, l.three_dart_average || 0), 0);

    return {
      avgMatchAverage,
      avgFirstNine,
      total180s,
      total140Plus,
      total100Plus,
      totalDoublesThrown,
      totalDoublesHit,
      totalTriplesThrown,
      totalTriplesHit,
      totalCheckoutAttempts,
      totalCheckoutsHit,
      highestCheckout,
      gamesWon,
      gamesPlayed,
      botWins,
      botGames,
      pvpWins,
      pvpGames,
      botAverage,
      pvpAverage,
      sectorHits,
      bestLegAverage,
    };
  };

  const agg = calculateAggregates();

  const doublesRate = agg.totalDoublesThrown > 0
    ? Math.round((agg.totalDoublesHit / agg.totalDoublesThrown) * 100)
    : 0;
  const triplesRate = agg.totalTriplesThrown > 0
    ? Math.round((agg.totalTriplesHit / agg.totalTriplesThrown) * 100)
    : 0;
  const checkoutRate = agg.totalCheckoutAttempts > 0
    ? Math.round((agg.totalCheckoutsHit / agg.totalCheckoutAttempts) * 100)
    : 0;
  const winRate = agg.gamesPlayed > 0
    ? Math.round((agg.gamesWon / agg.gamesPlayed) * 100)
    : 0;
  const botWinRate = agg.botGames > 0
    ? Math.round((agg.botWins / agg.botGames) * 100)
    : 0;
  const pvpWinRate = agg.pvpGames > 0
    ? Math.round((agg.pvpWins / agg.pvpGames) * 100)
    : 0;

  const weekDays = eachDayOfInterval({
    start: startOfWeek(new Date(), { weekStartsOn: 1 }),
    end: endOfWeek(new Date(), { weekStartsOn: 1 }),
  });

  const activityByDay = weekDays.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayMatches = matchStats.filter(m => format(new Date(m.created_at), 'yyyy-MM-dd') === dateStr);
    return {
      day: format(day, 'EEE', { locale: hu }),
      matches: dayMatches.length,
      hasActivity: dayMatches.length > 0,
    };
  });

  const maxMatches = Math.max(...activityByDay.map(d => d.matches), 1);

  const prepareExportData = (): ExportData => {
    const games = matchStats.map((match) => ({
      id: match.room_id,
      date: format(new Date(match.created_at), 'yyyy-MM-dd'),
      gameType: match.game_type,
      startingScore: 501,
      result: match.won ? 'win' as const : 'loss' as const,
      opponent: match.game_mode === 'bot' ? 'Bot' : 'Player',
      avgScore: match.match_average,
      checkouts: [],
      dartsThrown: 0,
    }));

    return {
      games,
      trainingSessions: [],
      statistics: {
        totalGames: agg.gamesPlayed,
        wins: agg.gamesWon,
        losses: agg.gamesPlayed - agg.gamesWon,
        winRate,
        avgScore: agg.avgMatchAverage,
        bestAvg: agg.bestLegAverage,
        highestCheckout: agg.highestCheckout,
        totalCheckouts: agg.totalCheckoutsHit,
        checkoutRate,
        total180s: agg.total180s,
        total140plus: agg.total140Plus,
        trainingHours: 0,
        favoriteDouble: 'D20',
      },
      generatedAt: new Date().toISOString(),
    };
  };

  const handleExportCSV = () => {
    exportAsCSV(prepareExportData());
    setShowExportMenu(false);
  };

  const handleExportJSON = () => {
    exportAsJSON(prepareExportData());
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    printReport(prepareExportData());
    setShowExportMenu(false);
  };

  const topSectors = Object.entries(agg.sectorHits)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500/10 dark:bg-primary-500/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Statisztikak</h1>
            <p className="text-dark-500 dark:text-dark-400">Reszletes teljesitmeny adatok</p>
          </div>
        </div>
        <div className="relative">
          <Button
            variant="outline"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={() => setShowExportMenu(!showExportMenu)}
          >
            Export
          </Button>
          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-800 rounded-lg shadow-lg border border-dark-200 dark:border-dark-700 py-1 z-10">
              <button
                onClick={handleExportCSV}
                className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-dark-50 dark:hover:bg-dark-700 text-dark-700 dark:text-dark-300"
              >
                <FileText className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={handleExportJSON}
                className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-dark-50 dark:hover:bg-dark-700 text-dark-700 dark:text-dark-300"
              >
                <FileJson className="w-4 h-4" />
                Export JSON
              </button>
              <button
                onClick={handlePrint}
                className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-dark-50 dark:hover:bg-dark-700 text-dark-700 dark:text-dark-300"
              >
                <Printer className="w-4 h-4" />
                Nyomtatas / PDF
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {(['week', 'month', 'all'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === p
                ? 'bg-primary-500 text-white'
                : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-300 hover:bg-dark-200 dark:hover:bg-dark-600'
            }`}
          >
            {p === 'week' ? 'Het' : p === 'month' ? 'Honap' : 'Osszes'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-dark-900 dark:text-white mb-4">
              Heti aktivitas
            </h3>
            <div className="flex items-end justify-between gap-2 h-24">
              {activityByDay.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex items-end justify-center h-16">
                    <div
                      className={`w-full max-w-8 rounded-t transition-all ${
                        day.hasActivity
                          ? 'bg-gradient-to-t from-primary-500 to-primary-400'
                          : 'bg-dark-200 dark:bg-dark-700'
                      }`}
                      style={{ height: `${Math.max((day.matches / maxMatches) * 100, 10)}%` }}
                    />
                  </div>
                  <span className="text-xs text-dark-500">{day.day}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<Target className="w-5 h-5 text-primary-500" />}
              label="Match atlag"
              value={agg.avgMatchAverage.toFixed(1)}
              color="bg-primary-500/10"
            />
            <StatCard
              icon={<Zap className="w-5 h-5 text-warning-500" />}
              label="Elso 9 nyil atlag"
              value={agg.avgFirstNine.toFixed(1)}
              color="bg-warning-500/10"
            />
            <StatCard
              icon={<Trophy className="w-5 h-5 text-success-500" />}
              label="Gyozelmi arany"
              value={`${winRate}%`}
              subValue={`${agg.gamesWon}/${agg.gamesPlayed} jatek`}
              color="bg-success-500/10"
            />
            <StatCard
              icon={<Award className="w-5 h-5 text-error-500" />}
              label="Legjobb leg atlag"
              value={agg.bestLegAverage.toFixed(1)}
              color="bg-error-500/10"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Bot className="w-5 h-5 text-primary-500" />
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white">
                  Bot ellen
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-dark-500">Jatekok</span>
                  <span className="font-semibold text-dark-900 dark:text-white">
                    {agg.botGames}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-500">Gyozelem arany</span>
                  <span className="font-semibold text-dark-900 dark:text-white">
                    {botWinRate}% ({agg.botWins}/{agg.botGames})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-500">Atlag</span>
                  <span className="font-semibold text-dark-900 dark:text-white">
                    {agg.botAverage.toFixed(1)}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-secondary-500" />
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white">
                  Valos jatekosok ellen
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-dark-500">Jatekok</span>
                  <span className="font-semibold text-dark-900 dark:text-white">
                    {agg.pvpGames}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-500">Gyozelem arany</span>
                  <span className="font-semibold text-dark-900 dark:text-white">
                    {pvpWinRate}% ({agg.pvpWins}/{agg.pvpGames})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-500">Atlag</span>
                  <span className="font-semibold text-dark-900 dark:text-white">
                    {agg.pvpAverage.toFixed(1)}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
              Magas korok
            </h3>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary-600 dark:text-primary-400">
                  {agg.total180s}
                </div>
                <div className="text-sm text-dark-500 mt-2">180s</div>
                <div className="text-xs text-dark-400 mt-1">Maximumok</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-warning-600 dark:text-warning-400">
                  {agg.total140Plus}
                </div>
                <div className="text-sm text-dark-500 mt-2">140+</div>
                <div className="text-xs text-dark-400 mt-1">Ton 40+</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-success-600 dark:text-success-400">
                  {agg.total100Plus}
                </div>
                <div className="text-sm text-dark-500 mt-2">100+</div>
                <div className="text-xs text-dark-400 mt-1">Tons</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
              Celzasi pontossag
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Crosshair className="w-4 h-4 text-primary-500" />
                    <span className="text-sm font-medium text-dark-700 dark:text-dark-300">Duplak</span>
                  </div>
                  <span className="text-sm font-bold text-dark-900 dark:text-white">
                    {doublesRate}% ({agg.totalDoublesHit}/{agg.totalDoublesThrown})
                  </span>
                </div>
                <div className="h-2 bg-dark-100 dark:bg-dark-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all"
                    style={{ width: `${doublesRate}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Crosshair className="w-4 h-4 text-secondary-500" />
                    <span className="text-sm font-medium text-dark-700 dark:text-dark-300">Triplak</span>
                  </div>
                  <span className="text-sm font-bold text-dark-900 dark:text-white">
                    {triplesRate}% ({agg.totalTriplesHit}/{agg.totalTriplesThrown})
                  </span>
                </div>
                <div className="h-2 bg-dark-100 dark:bg-dark-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary-500 rounded-full transition-all"
                    style={{ width: `${triplesRate}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-success-500" />
                    <span className="text-sm font-medium text-dark-700 dark:text-dark-300">Kiszallok</span>
                  </div>
                  <span className="text-sm font-bold text-dark-900 dark:text-white">
                    {checkoutRate}% ({agg.totalCheckoutsHit}/{agg.totalCheckoutAttempts})
                  </span>
                </div>
                <div className="h-2 bg-dark-100 dark:bg-dark-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success-500 rounded-full transition-all"
                    style={{ width: `${checkoutRate}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {topSectors.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
                Top szektorok
              </h3>
              <div className="space-y-3">
                {topSectors.map(([sector, hits], idx) => (
                  <div key={sector} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center text-sm font-bold text-primary-600">
                        #{idx + 1}
                      </div>
                      <span className="font-medium text-dark-700 dark:text-dark-300">
                        {sector}
                      </span>
                    </div>
                    <span className="font-bold text-dark-900 dark:text-white">
                      {hits} talalat
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
                Profil statisztikak
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-dark-500">Osszes jatek</span>
                  <span className="font-semibold text-dark-900 dark:text-white">
                    {agg.gamesPlayed}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-500">Osszes gyozelem</span>
                  <span className="font-semibold text-dark-900 dark:text-white">
                    {agg.gamesWon}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-500">Match atlag</span>
                  <span className="font-semibold text-dark-900 dark:text-white">
                    {agg.avgMatchAverage.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-500">Legjobb leg</span>
                  <span className="font-semibold text-dark-900 dark:text-white">
                    {agg.bestLegAverage.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-500">Legmagasabb kiszallo</span>
                  <span className="font-semibold text-dark-900 dark:text-white">
                    {agg.highestCheckout}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
                Kiszallok
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-dark-500">Osszes kiszallo</span>
                  <span className="font-semibold text-dark-900 dark:text-white">
                    {agg.totalCheckoutsHit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-500">Kiszallo arany</span>
                  <span className="font-semibold text-dark-900 dark:text-white">
                    {checkoutRate}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-500">Legmagasabb</span>
                  <span className="font-semibold text-dark-900 dark:text-white">
                    {agg.highestCheckout}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-500">Probalkozasok</span>
                  <span className="font-semibold text-dark-900 dark:text-white">
                    {agg.totalCheckoutAttempts}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
