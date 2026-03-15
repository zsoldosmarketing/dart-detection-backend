import { useState, useEffect, useMemo } from 'react';
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
  ChevronUp,
  ChevronDown,
  Calendar,
  Clock,
  Hash,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Star,
  Activity,
  CheckCircle2,
  XCircle,
  Shield,
  Swords,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { hu } from 'date-fns/locale';
import { exportAsCSV, exportAsJSON, printReport, type ExportData } from '../lib/exportUtils';
import { t } from '../lib/i18n';
import clsx from 'clsx';

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

interface MatchHistoryItem extends MatchStats {
  game_rooms?: {
    starting_score: number;
    mode: string;
  };
}

export function StatisticsPage() {
  const { user, profile } = useAuthStore();
  const [matchStats, setMatchStats] = useState<MatchStats[]>([]);
  const [legStats, setLegStats] = useState<LegStats[]>([]);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryItem[]>([]);
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

    const [matchRes, legRes, matchHistoryRes] = await Promise.all([
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
      supabase
        .from('match_statistics')
        .select('*, game_rooms(starting_score, mode)')
        .eq('player_id', user.id)
        .gte('created_at', fromDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    setMatchStats(matchRes.data || []);
    setLegStats(legRes.data || []);
    setMatchHistory(matchHistoryRes.data || []);
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
    const total171_179 = legStats.reduce((sum, l) => sum + (l.visits_171_179 || 0), 0);
    const total160_170 = legStats.reduce((sum, l) => sum + (l.visits_160_170 || 0), 0);
    const total140_159 = legStats.reduce((sum, l) => sum + (l.visits_140_159 || 0), 0);
    const total120_139 = legStats.reduce((sum, l) => sum + (l.visits_120_139 || 0), 0);
    const total100_119 = legStats.reduce((sum, l) => sum + (l.visits_100_119 || 0), 0);
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

    const totalDurationSeconds = matchStats.reduce((sum, m) => sum + (m.duration_seconds || 0), 0);

    return {
      avgMatchAverage,
      avgFirstNine,
      total180s,
      total171_179,
      total160_170,
      total140_159,
      total120_139,
      total100_119,
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
      totalDurationSeconds,
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
      fullDay: format(day, 'EEEE', { locale: hu }),
      date: format(day, 'MMM d', { locale: hu }),
      matches: dayMatches.length,
      hasActivity: dayMatches.length > 0,
    };
  });

  const maxMatches = Math.max(...activityByDay.map(d => d.matches), 1);

  const scoringBreakdown = useMemo(() => {
    const items = [
      { label: '180', count: agg.total180s, color: 'from-amber-400 to-yellow-500', textColor: 'text-amber-500', bgColor: 'bg-amber-500' },
      { label: '171-179', count: agg.total171_179, color: 'from-amber-300 to-amber-400', textColor: 'text-amber-400', bgColor: 'bg-amber-400' },
      { label: '160-170', count: agg.total160_170, color: 'from-sky-400 to-blue-500', textColor: 'text-blue-500', bgColor: 'bg-blue-500' },
      { label: '140-159', count: agg.total140_159, color: 'from-sky-300 to-sky-500', textColor: 'text-sky-500', bgColor: 'bg-sky-500' },
      { label: '120-139', count: agg.total120_139, color: 'from-teal-400 to-emerald-500', textColor: 'text-emerald-500', bgColor: 'bg-emerald-500' },
      { label: '100-119', count: agg.total100_119, color: 'from-emerald-300 to-green-500', textColor: 'text-green-500', bgColor: 'bg-green-500' },
    ];
    const maxCount = Math.max(...items.map(i => i.count), 1);
    const totalScoring = items.reduce((sum, i) => sum + i.count, 0);
    return { items, maxCount, totalScoring };
  }, [agg]);

  const topSectors = Object.entries(agg.sectorHits)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const maxSectorHits = topSectors.length > 0 ? topSectors[0][1] : 1;

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

  const periodLabel = period === 'week' ? t('stats.period_week') : period === 'month' ? t('stats.period_month') : t('stats.period_all');

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 md:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark-900 dark:text-white">{t('stats.title')}</h1>
            <p className="text-sm text-dark-500 dark:text-dark-400">{t('stats.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-dark-100 dark:bg-dark-700 rounded-lg p-1">
            {(['week', 'month', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={clsx(
                  'px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200',
                  period === p
                    ? 'bg-white dark:bg-dark-600 text-dark-900 dark:text-white shadow-sm'
                    : 'text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200'
                )}
              >
                {p === 'week' ? t('stats.period_week') : p === 'month' ? t('stats.period_month') : t('stats.period_all')}
              </button>
            ))}
          </div>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={() => setShowExportMenu(!showExportMenu)}
            >
              Export
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-dark-800 rounded-xl shadow-xl border border-dark-200 dark:border-dark-700 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                <button
                  onClick={handleExportCSV}
                  className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-dark-50 dark:hover:bg-dark-700 text-dark-700 dark:text-dark-300 transition-colors"
                >
                  <FileText className="w-4 h-4 text-dark-400" />
                  <span className="text-sm font-medium">Export CSV</span>
                </button>
                <button
                  onClick={handleExportJSON}
                  className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-dark-50 dark:hover:bg-dark-700 text-dark-700 dark:text-dark-300 transition-colors"
                >
                  <FileJson className="w-4 h-4 text-dark-400" />
                  <span className="text-sm font-medium">Export JSON</span>
                </button>
                <div className="border-t border-dark-100 dark:border-dark-700 my-1" />
                <button
                  onClick={handlePrint}
                  className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-dark-50 dark:hover:bg-dark-700 text-dark-700 dark:text-dark-300 transition-colors"
                >
                  <Printer className="w-4 h-4 text-dark-400" />
                  <span className="text-sm font-medium">Nyomtatas / PDF</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-dark-500 dark:text-dark-400">Statisztikak betoltese...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card padding="none" className="p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-primary-500/10 to-transparent rounded-bl-full" />
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center">
                  <Target className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                <span className="text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">Match atlag</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="stat-value text-3xl font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {agg.avgMatchAverage.toFixed(1)}
                </span>
                <span className="text-xs text-dark-400 dark:text-dark-500 mb-1">3-nyil atlag</span>
              </div>
              {agg.gamesPlayed >= 2 && (
                <div className="flex items-center gap-1 mt-2">
                  {matchStats.length >= 2 && matchStats[0].match_average > matchStats[1].match_average ? (
                    <>
                      <ArrowUpRight className="w-3.5 h-3.5 text-success-500" />
                      <span className="text-xs font-medium text-success-600 dark:text-success-400">Javulo</span>
                    </>
                  ) : matchStats.length >= 2 && matchStats[0].match_average < matchStats[1].match_average ? (
                    <>
                      <ArrowDownRight className="w-3.5 h-3.5 text-error-500" />
                      <span className="text-xs font-medium text-error-600 dark:text-error-400">Csokken</span>
                    </>
                  ) : (
                    <>
                      <Minus className="w-3.5 h-3.5 text-dark-400" />
                      <span className="text-xs font-medium text-dark-400">Stabil</span>
                    </>
                  )}
                </div>
              )}
            </Card>

            <Card padding="none" className="p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-bl-full" />
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">Elso 9 nyil</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="stat-value text-3xl font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {agg.avgFirstNine.toFixed(1)}
                </span>
                <span className="text-xs text-dark-400 dark:text-dark-500 mb-1">atlag</span>
              </div>
              <div className="mt-2">
                <span className="text-xs text-dark-400">{legStats.length} leg alapjan</span>
              </div>
            </Card>

            <Card padding="none" className="p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-success-500/10 to-transparent rounded-bl-full" />
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-success-500/10 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-success-600 dark:text-success-400" />
                </div>
                <span className="text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">Gyozelmi arany</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="stat-value text-3xl font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {winRate}%
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="success" size="sm">{agg.gamesWon}W</Badge>
                <Badge variant="error" size="sm">{agg.gamesPlayed - agg.gamesWon}L</Badge>
                <span className="text-xs text-dark-400">{agg.gamesPlayed} meccse</span>
              </div>
            </Card>

            <Card padding="none" className="p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-rose-500/10 to-transparent rounded-bl-full" />
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                  <Award className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                </div>
                <span className="text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">Legjobb leg</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="stat-value text-3xl font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {agg.bestLegAverage.toFixed(1)}
                </span>
                <span className="text-xs text-dark-400 dark:text-dark-500 mb-1">atlag</span>
              </div>
              <div className="mt-2">
                <span className="text-xs text-dark-400">Szemelyes rekord ({periodLabel})</span>
              </div>
            </Card>
          </div>

          <Card padding="none" className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary-500" />
                <h2 className="section-title text-lg font-semibold text-dark-900 dark:text-white">Heti aktivitas</h2>
              </div>
              <span className="text-sm text-dark-400">
                {activityByDay.reduce((sum, d) => sum + d.matches, 0)} meccs ezen a heten
              </span>
            </div>
            <div className="flex items-end justify-between gap-3 h-40">
              {activityByDay.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="relative w-full flex flex-col items-center">
                    <span
                      className={clsx(
                        'text-xs font-bold mb-1 transition-opacity',
                        day.hasActivity ? 'opacity-100 text-primary-600 dark:text-primary-400' : 'opacity-0 group-hover:opacity-100 text-dark-400'
                      )}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {day.matches}
                    </span>
                    <div className="w-full flex items-end justify-center h-24">
                      <div
                        className={clsx(
                          'w-full max-w-10 rounded-lg transition-all duration-500 ease-out',
                          day.hasActivity
                            ? 'bg-gradient-to-t from-primary-600 to-primary-400 shadow-sm shadow-primary-500/20'
                            : 'bg-dark-100 dark:bg-dark-700'
                        )}
                        style={{
                          height: `${Math.max((day.matches / maxMatches) * 100, 8)}%`,
                          animationDelay: `${i * 80}ms`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <span className={clsx(
                      'text-xs font-medium block capitalize',
                      day.hasActivity ? 'text-dark-700 dark:text-dark-200' : 'text-dark-400 dark:text-dark-500'
                    )}>
                      {day.day}
                    </span>
                    <span className="text-[10px] text-dark-400 dark:text-dark-500">{day.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="none" className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500" />
                <h2 className="section-title text-lg font-semibold text-dark-900 dark:text-white">Pontozasi bontasa</h2>
              </div>
              <span className="text-sm text-dark-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
                Ossz: {scoringBreakdown.totalScoring} magas kor
              </span>
            </div>

            <div className="flex items-center justify-center mb-8">
              <div className="relative">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <div className="w-24 h-24 rounded-full bg-white dark:bg-dark-800 flex flex-col items-center justify-center">
                    <span className="stat-value text-3xl font-black text-amber-500" style={{ fontVariantNumeric: 'tabular-nums' }}>{agg.total180s}</span>
                    <span className="text-[10px] font-bold text-amber-600/70 uppercase tracking-widest">180s</span>
                  </div>
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center shadow-md">
                  <Star className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {scoringBreakdown.items.map((item, idx) => {
                const pct = scoringBreakdown.totalScoring > 0
                  ? Math.round((item.count / scoringBreakdown.totalScoring) * 100)
                  : 0;
                const barWidth = scoringBreakdown.maxCount > 0
                  ? Math.max((item.count / scoringBreakdown.maxCount) * 100, 2)
                  : 2;
                return (
                  <div key={item.label} className="group" style={{ animationDelay: `${idx * 60}ms` }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-3">
                        <span className={clsx(
                          'text-sm font-bold min-w-[72px]',
                          item.textColor
                        )}>{item.label}</span>
                        {item.label === '180' && <Badge variant="warning" size="sm">MAX</Badge>}
                        {item.label === '140-159' && <span className="text-[10px] text-dark-400 font-medium">Ton 40+</span>}
                        {item.label === '100-119' && <span className="text-[10px] text-dark-400 font-medium">Tons</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-dark-400" style={{ fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                        <span className="text-sm font-bold text-dark-900 dark:text-white min-w-[32px] text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {item.count}
                        </span>
                      </div>
                    </div>
                    <div className="h-3 bg-dark-100 dark:bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out', item.color)}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card padding="none" className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <Crosshair className="w-5 h-5 text-primary-500" />
                <h2 className="section-title text-lg font-semibold text-dark-900 dark:text-white">Celzasi pontossag</h2>
              </div>
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-dark-700 dark:text-dark-300">Duplak</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-dark-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {agg.totalDoublesHit}/{agg.totalDoublesThrown}
                      </span>
                      <span className="text-sm font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {doublesRate}%
                      </span>
                    </div>
                  </div>
                  <div className="h-3 bg-dark-100 dark:bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-700"
                      style={{ width: `${doublesRate}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-dark-700 dark:text-dark-300">Triplak</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-dark-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {agg.totalTriplesHit}/{agg.totalTriplesThrown}
                      </span>
                      <span className="text-sm font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {triplesRate}%
                      </span>
                    </div>
                  </div>
                  <div className="h-3 bg-dark-100 dark:bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-600 transition-all duration-700"
                      style={{ width: `${triplesRate}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-dark-700 dark:text-dark-300">Kiszallok</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-dark-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {agg.totalCheckoutsHit}/{agg.totalCheckoutAttempts}
                      </span>
                      <span className="text-sm font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {checkoutRate}%
                      </span>
                    </div>
                  </div>
                  <div className="h-3 bg-dark-100 dark:bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-700"
                      style={{ width: `${checkoutRate}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card padding="none" className="p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-6">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h2 className="section-title text-lg font-semibold text-dark-900 dark:text-white">Kiszallo reszletek</h2>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4">
                  <div className="w-20 h-20 rounded-full bg-white dark:bg-dark-800 flex flex-col items-center justify-center">
                    <span className="stat-value text-2xl font-black text-emerald-600 dark:text-emerald-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {agg.highestCheckout}
                    </span>
                    <span className="text-[9px] font-bold text-emerald-600/60 uppercase tracking-widest">Max</span>
                  </div>
                </div>
                <p className="text-sm font-medium text-dark-700 dark:text-dark-300">Legmagasabb kiszallo</p>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-dark-100 dark:border-dark-700">
                <div className="text-center">
                  <span className="stat-value text-lg font-bold text-dark-900 dark:text-white block" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {agg.totalCheckoutsHit}
                  </span>
                  <span className="text-[10px] text-dark-400 uppercase">Sikeres</span>
                </div>
                <div className="text-center">
                  <span className="stat-value text-lg font-bold text-dark-900 dark:text-white block" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {agg.totalCheckoutAttempts}
                  </span>
                  <span className="text-[10px] text-dark-400 uppercase">Kiserlet</span>
                </div>
                <div className="text-center">
                  <span className="stat-value text-lg font-bold text-dark-900 dark:text-white block" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {checkoutRate}%
                  </span>
                  <span className="text-[10px] text-dark-400 uppercase">Arany</span>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card padding="none" className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <Bot className="w-5 h-5 text-primary-500" />
                <h2 className="section-title text-lg font-semibold text-dark-900 dark:text-white">Bot ellen</h2>
                <Badge variant="primary" size="sm">{agg.botGames} meccs</Badge>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-dark-500">Gyozelmi arany</span>
                    <span className="text-sm font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {botWinRate}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-dark-100 dark:bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-500"
                      style={{ width: `${botWinRate}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-dark-50 dark:bg-dark-700/50 rounded-lg p-3 text-center">
                    <span className="stat-value text-lg font-bold text-dark-900 dark:text-white block" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {agg.botWins}
                    </span>
                    <span className="text-[10px] text-dark-400 uppercase">Gyozelem</span>
                  </div>
                  <div className="bg-dark-50 dark:bg-dark-700/50 rounded-lg p-3 text-center">
                    <span className="stat-value text-lg font-bold text-dark-900 dark:text-white block" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {agg.botGames - agg.botWins}
                    </span>
                    <span className="text-[10px] text-dark-400 uppercase">Vereseg</span>
                  </div>
                  <div className="bg-dark-50 dark:bg-dark-700/50 rounded-lg p-3 text-center">
                    <span className="stat-value text-lg font-bold text-dark-900 dark:text-white block" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {agg.botAverage.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-dark-400 uppercase">Atlag</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card padding="none" className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <Users className="w-5 h-5 text-teal-500" />
                <h2 className="section-title text-lg font-semibold text-dark-900 dark:text-white">Jatekos ellen (PVP)</h2>
                <Badge variant="default" size="sm">{agg.pvpGames} meccs</Badge>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-dark-500">Gyozelmi arany</span>
                    <span className="text-sm font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {pvpWinRate}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-dark-100 dark:bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-600 transition-all duration-500"
                      style={{ width: `${pvpWinRate}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-dark-50 dark:bg-dark-700/50 rounded-lg p-3 text-center">
                    <span className="stat-value text-lg font-bold text-dark-900 dark:text-white block" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {agg.pvpWins}
                    </span>
                    <span className="text-[10px] text-dark-400 uppercase">Gyozelem</span>
                  </div>
                  <div className="bg-dark-50 dark:bg-dark-700/50 rounded-lg p-3 text-center">
                    <span className="stat-value text-lg font-bold text-dark-900 dark:text-white block" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {agg.pvpGames - agg.pvpWins}
                    </span>
                    <span className="text-[10px] text-dark-400 uppercase">Vereseg</span>
                  </div>
                  <div className="bg-dark-50 dark:bg-dark-700/50 rounded-lg p-3 text-center">
                    <span className="stat-value text-lg font-bold text-dark-900 dark:text-white block" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {agg.pvpAverage.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-dark-400 uppercase">Atlag</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {agg.botGames > 0 && agg.pvpGames > 0 && (
            <Card padding="none" className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <Swords className="w-5 h-5 text-dark-500" />
                <h2 className="section-title text-lg font-semibold text-dark-900 dark:text-white">Bot vs PVP osszehasonlitas</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-dark-500">Gyozelmi arany</span>
                    <div className="flex items-center gap-4 text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      <span className="text-primary-600 dark:text-primary-400 font-bold">Bot {botWinRate}%</span>
                      <span className="text-teal-600 dark:text-teal-400 font-bold">PVP {pvpWinRate}%</span>
                    </div>
                  </div>
                  <div className="flex gap-1 h-3">
                    <div className="flex-1 bg-dark-100 dark:bg-dark-700 rounded-l-full overflow-hidden">
                      <div
                        className="h-full rounded-l-full bg-gradient-to-r from-primary-400 to-primary-600"
                        style={{ width: `${botWinRate}%` }}
                      />
                    </div>
                    <div className="flex-1 bg-dark-100 dark:bg-dark-700 rounded-r-full overflow-hidden">
                      <div
                        className="h-full rounded-r-full bg-gradient-to-r from-teal-400 to-teal-600"
                        style={{ width: `${pvpWinRate}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-dark-500">Match atlag</span>
                    <div className="flex items-center gap-4 text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      <span className="text-primary-600 dark:text-primary-400 font-bold">Bot {agg.botAverage.toFixed(1)}</span>
                      <span className="text-teal-600 dark:text-teal-400 font-bold">PVP {agg.pvpAverage.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 h-3">
                    {(() => {
                      const maxAvg = Math.max(agg.botAverage, agg.pvpAverage, 1);
                      return (
                        <>
                          <div className="flex-1 bg-dark-100 dark:bg-dark-700 rounded-l-full overflow-hidden">
                            <div
                              className="h-full rounded-l-full bg-gradient-to-r from-primary-400 to-primary-600"
                              style={{ width: `${(agg.botAverage / maxAvg) * 100}%` }}
                            />
                          </div>
                          <div className="flex-1 bg-dark-100 dark:bg-dark-700 rounded-r-full overflow-hidden">
                            <div
                              className="h-full rounded-r-full bg-gradient-to-r from-teal-400 to-teal-600"
                              style={{ width: `${(agg.pvpAverage / maxAvg) * 100}%` }}
                            />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {topSectors.length > 0 && (
            <Card padding="none" className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <Target className="w-5 h-5 text-primary-500" />
                <h2 className="section-title text-lg font-semibold text-dark-900 dark:text-white">Top szektorok</h2>
              </div>
              <div className="space-y-3">
                {topSectors.map(([sector, hits], idx) => {
                  const barWidth = Math.max((hits / maxSectorHits) * 100, 4);
                  const medalColors = [
                    'from-amber-400 to-yellow-500 text-amber-700',
                    'from-gray-300 to-gray-400 text-gray-600',
                    'from-orange-400 to-amber-600 text-orange-800',
                    'from-dark-200 to-dark-300 text-dark-600',
                    'from-dark-200 to-dark-300 text-dark-600',
                  ];
                  return (
                    <div key={sector} className="flex items-center gap-3" style={{ animationDelay: `${idx * 80}ms` }}>
                      <div className={clsx(
                        'w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-xs font-black flex-shrink-0',
                        medalColors[idx]
                      )}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-dark-800 dark:text-dark-200">{sector}</span>
                          <span className="text-sm font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {hits} talalat
                          </span>
                        </div>
                        <div className="h-2 bg-dark-100 dark:bg-dark-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-500"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {matchHistory.length > 0 && (
            <Card padding="none" className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary-500" />
                  <h2 className="section-title text-lg font-semibold text-dark-900 dark:text-white">Meccs elozmeny</h2>
                </div>
                <Badge variant="default" size="sm">Utolso {matchHistory.length}</Badge>
              </div>
              <div className="overflow-x-auto -mx-6">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-dark-100 dark:border-dark-700">
                      <th className="text-left text-xs font-semibold text-dark-400 uppercase tracking-wider px-6 py-3">Datum</th>
                      <th className="text-left text-xs font-semibold text-dark-400 uppercase tracking-wider px-3 py-3">Tipus</th>
                      <th className="text-center text-xs font-semibold text-dark-400 uppercase tracking-wider px-3 py-3">Eredmeny</th>
                      <th className="text-right text-xs font-semibold text-dark-400 uppercase tracking-wider px-3 py-3">Atlag</th>
                      <th className="text-center text-xs font-semibold text-dark-400 uppercase tracking-wider px-3 py-3">Legek</th>
                      <th className="text-right text-xs font-semibold text-dark-400 uppercase tracking-wider px-3 py-3">Kiszallo</th>
                      <th className="text-right text-xs font-semibold text-dark-400 uppercase tracking-wider px-6 py-3">Ellenfel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-50 dark:divide-dark-700/50">
                    {matchHistory.map((match, idx) => (
                      <tr
                        key={match.id}
                        className="hover:bg-dark-50 dark:hover:bg-dark-700/30 transition-colors"
                        style={{ animationDelay: `${idx * 40}ms` }}
                      >
                        <td className="px-6 py-3">
                          <span className="text-sm text-dark-700 dark:text-dark-300" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {format(new Date(match.created_at), 'MMM d, HH:mm', { locale: hu })}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant="default" size="sm">
                            {match.game_rooms?.starting_score || match.game_type}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {match.won ? (
                            <Badge variant="success" size="sm">Gyozelem</Badge>
                          ) : (
                            <Badge variant="error" size="sm">Vereseg</Badge>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-sm font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {(match.match_average || 0).toFixed(1)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-sm font-medium text-dark-700 dark:text-dark-300" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {match.legs_won}-{match.legs_lost}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className={clsx(
                            'text-sm font-bold',
                            match.highest_checkout > 100
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-dark-700 dark:text-dark-300'
                          )} style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {match.highest_checkout > 0 ? match.highest_checkout : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span className="text-sm text-dark-500">
                            {match.game_mode === 'bot' ? (
                              <span className="inline-flex items-center gap-1">
                                <Bot className="w-3.5 h-3.5" />
                                Bot
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                Jatekos
                              </span>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {matchStats.length === 0 && (
            <Card padding="none" className="p-12">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-dark-100 dark:bg-dark-700 flex items-center justify-center mb-4">
                  <BarChart3 className="w-8 h-8 text-dark-400" />
                </div>
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">Nincs adat</h3>
                <p className="text-sm text-dark-500 dark:text-dark-400 max-w-sm">
                  Meg nincs statisztikat ebben az idoszakban. Jatssz nehany meccset, hogy megjelenjenek az adatok!
                </p>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
