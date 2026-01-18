import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

interface MatchInfo {
  id: string;
  game_type: string;
  game_mode: string;
  starting_score: number;
  status: string;
  created_at: string;
  players: Array<{
    id: string;
    display_name: string;
    is_bot: boolean;
  }>;
}

interface PlayerMatchStats {
  player_id: string;
  display_name: string;
  is_bot: boolean;
  won: boolean;
  sets_won: number;
  legs_won: number;
  match_average: number;
  best_leg_average: number;
  first_9_average: number;
  highest_checkout: number;
  total_180s: number;
  visits_60_plus: number;
  visits_100_plus: number;
  visits_140_plus: number;
  total_darts: number;
  doubles_hit: number;
  doubles_thrown: number;
  double_percentage: number;
  triples_hit: number;
  triples_thrown: number;
  triple_percentage: number;
  checkouts_hit: number;
  checkout_attempts: number;
  checkout_percentage: number;
  min_darts_leg: number;
  sector_hits: Record<string, number>;
}

export function DetailedStatisticsPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerMatchStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (matchId) {
      loadMatchStatistics();
    }
  }, [matchId]);

  const loadMatchStatistics = async () => {
    if (!matchId) return;

    setIsLoading(true);

    const { data: room } = await supabase
      .from('game_rooms')
      .select(`
        *,
        game_players!inner(
          id,
          display_name,
          is_bot,
          user_id
        )
      `)
      .eq('id', matchId)
      .single();

    if (room) {
      setMatchInfo({
        id: room.id,
        game_type: room.game_type,
        game_mode: room.game_mode,
        starting_score: room.starting_score,
        status: room.status,
        created_at: room.created_at,
        players: room.game_players || [],
      });

      const { data: matchStats } = await supabase
        .from('match_statistics')
        .select('*')
        .eq('room_id', matchId);

      if (matchStats) {
        const enrichedStats = await Promise.all(
          matchStats.map(async (stat) => {
            const { data: legData } = await supabase
              .from('leg_statistics')
              .select('*')
              .eq('room_id', matchId)
              .eq('player_id', stat.player_id);

            const totalDarts = legData?.reduce((sum, leg) => sum + (leg.total_darts || 0), 0) || 0;
            const doublesHit = legData?.reduce((sum, leg) => sum + (leg.doubles_hit || 0), 0) || 0;
            const doublesThrown = legData?.reduce((sum, leg) => sum + (leg.doubles_thrown || 0), 0) || 0;
            const triplesHit = legData?.reduce((sum, leg) => sum + (leg.triples_hit || 0), 0) || 0;
            const triplesThrown = legData?.reduce((sum, leg) => sum + (leg.triples_thrown || 0), 0) || 0;
            const visits60Plus = legData?.reduce((sum, leg) => sum + (leg.visits_60_plus || 0), 0) || 0;
            const visits100Plus = legData?.reduce((sum, leg) => sum + (leg.visits_100_plus || 0), 0) || 0;
            const visits140Plus = legData?.reduce((sum, leg) => sum + (leg.visits_140_plus || 0), 0) || 0;
            const minDartsLeg = legData?.reduce((min, leg) => {
              if (leg.total_darts > 0 && (min === 0 || leg.total_darts < min)) {
                return leg.total_darts;
              }
              return min;
            }, 0) || 0;

            const first9Averages = legData?.filter(leg => leg.first_9_average > 0).map(leg => leg.first_9_average) || [];
            const avgFirst9 = first9Averages.length > 0
              ? first9Averages.reduce((sum, avg) => sum + avg, 0) / first9Averages.length
              : 0;

            const sectorHits: Record<string, number> = {};
            legData?.forEach(leg => {
              if (leg.sector_hits) {
                Object.entries(leg.sector_hits as Record<string, number>).forEach(([sector, hits]) => {
                  sectorHits[sector] = (sectorHits[sector] || 0) + hits;
                });
              }
            });

            const { data: checkoutData } = await supabase
              .from('checkout_attempts')
              .select('*')
              .eq('room_id', matchId)
              .eq('player_id', stat.player_id);

            const checkoutsHit = checkoutData?.filter(c => c.was_successful).length || 0;
            const checkoutAttempts = checkoutData?.length || 0;

            const player = room.game_players.find((p: any) => p.user_id === stat.player_id);

            return {
              player_id: stat.player_id,
              display_name: player?.display_name || 'Unknown',
              is_bot: player?.is_bot || false,
              won: stat.won,
              sets_won: stat.sets_won,
              legs_won: stat.legs_won,
              match_average: stat.match_average,
              best_leg_average: stat.best_leg_average,
              first_9_average: avgFirst9,
              highest_checkout: stat.highest_checkout,
              total_180s: stat.total_180s,
              visits_60_plus: visits60Plus,
              visits_100_plus: visits100Plus,
              visits_140_plus: visits140Plus,
              total_darts: totalDarts,
              doubles_hit: doublesHit,
              doubles_thrown: doublesThrown,
              double_percentage: doublesThrown > 0 ? (doublesHit / doublesThrown * 100) : 0,
              triples_hit: triplesHit,
              triples_thrown: triplesThrown,
              triple_percentage: triplesThrown > 0 ? (triplesHit / triplesThrown * 100) : 0,
              checkouts_hit: checkoutsHit,
              checkout_attempts: checkoutAttempts,
              checkout_percentage: checkoutAttempts > 0 ? (checkoutsHit / checkoutAttempts * 100) : 0,
              min_darts_leg: minDartsLeg,
              sector_hits: sectorHits,
            };
          })
        );

        setPlayerStats(enrichedStats);
      }
    }

    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!matchInfo || playerStats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-dark-700 dark:text-dark-300 mb-2">
            Nem található meccs statisztika
          </h3>
          <button
            onClick={() => navigate('/game-history')}
            className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            Vissza
          </button>
        </div>
      </div>
    );
  }

  const player1 = playerStats[0];
  const player2 = playerStats[1];

  return (
    <div className="space-y-3 animate-fade-in pb-6 px-3">
      <div className="flex items-center gap-3 sticky top-0 bg-white dark:bg-dark-900 z-10 py-3">
        <button
          onClick={() => navigate('/game-history')}
          className="p-2 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-dark-600 dark:text-dark-400" />
        </button>
        <h1 className="text-xl font-bold text-dark-900 dark:text-white">Statisztika</h1>
      </div>

      <Card className="bg-dark-900 text-white">
        <div className="text-center py-2">
          <h2 className="text-xl font-bold mb-1">Eredmény</h2>
          <p className="text-xs text-dark-300">
            {new Date(matchInfo.created_at).toLocaleString('hu-HU', {
              month: '2-digit',
              day: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
          <p className="text-xs text-dark-400 mt-1">
            {matchInfo.status === 'completed' ? 'Befejezett' : 'IN PROGRESS'} • X01 ({matchInfo.starting_score}, Double Out, Best of 1 Szett 7 Leg)
          </p>
        </div>

        <div className="grid grid-cols-2 divide-x divide-dark-700 border-t border-dark-700">
          {playerStats.map((stats, idx) => (
            <div key={stats.player_id} className={`py-3 px-3 ${idx === 0 ? 'text-left' : 'text-right'}`}>
              <div className="mb-1">
                <p className="text-xs text-dark-400">
                  {idx + 1}. {stats.display_name}
                </p>
              </div>
              <div className="flex flex-col gap-0.5">
                <div className={`flex ${idx === 0 ? 'justify-start' : 'justify-end'} items-baseline gap-2`}>
                  <span className="text-xs text-dark-400">Szett</span>
                  <span className="text-base font-bold">{stats.sets_won} Leg</span>
                  <Badge variant={stats.won ? 'success' : 'default'} size="sm">
                    {stats.legs_won}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle className="text-sm">Leg</CardTitle>
        <div className="mt-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dark-200 dark:border-dark-700">
                <th className="text-left py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">Játékos</th>
                <th className="text-center py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">Leg</th>
                <th className="text-center py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">Legs Won</th>
                <th className="text-right py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">Legs Win %</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.map((stats, idx) => {
                const totalLegs = player1.legs_won + player2.legs_won;
                const winPct = totalLegs > 0 ? ((stats.legs_won / totalLegs) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={stats.player_id} className="border-b border-dark-100 dark:border-dark-800 last:border-0">
                    <td className="py-1.5 px-1 font-medium text-dark-900 dark:text-white">{idx + 1}. {stats.display_name}</td>
                    <td className="text-center py-1.5 px-1 text-dark-700 dark:text-dark-300">{totalLegs}</td>
                    <td className="text-center py-1.5 px-1 text-dark-700 dark:text-dark-300">{stats.legs_won}</td>
                    <td className="text-right py-1.5 px-1 font-semibold text-dark-900 dark:text-white">{winPct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardTitle className="text-sm">Darts</CardTitle>
        <div className="mt-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dark-200 dark:border-dark-700">
                <th className="text-left py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">Játékos</th>
                <th className="text-right py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">Darts</th>
                <th className="text-right py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">Double %</th>
                <th className="text-right py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">Triple %</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.map((stats, idx) => (
                <tr key={stats.player_id} className="border-b border-dark-100 dark:border-dark-800 last:border-0">
                  <td className="py-1.5 px-1 font-medium text-dark-900 dark:text-white">{idx + 1}. {stats.display_name}</td>
                  <td className="text-right py-1.5 px-1 text-dark-700 dark:text-dark-300">{stats.total_darts}</td>
                  <td className="text-right py-1.5 px-1 font-semibold text-dark-900 dark:text-white">{stats.double_percentage.toFixed(1)}%</td>
                  <td className="text-right py-1.5 px-1 font-semibold text-dark-900 dark:text-white">{stats.triple_percentage.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardTitle className="text-sm">Átlagos és maximális pontszám</CardTitle>
        <div className="mt-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dark-200 dark:border-dark-700">
                <th className="text-left py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">Játékos</th>
                <th className="text-right py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">Átlagos ✓</th>
                <th className="text-right py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">Első 9 ✓</th>
                <th className="text-right py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">Max Pontok</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.map((stats, idx) => (
                <tr key={stats.player_id} className="border-b border-dark-100 dark:border-dark-800 last:border-0">
                  <td className="py-1.5 px-1 font-medium text-dark-900 dark:text-white">{idx + 1}. {stats.display_name}</td>
                  <td className="text-right py-1.5 px-1 font-semibold text-dark-900 dark:text-white">{stats.match_average.toFixed(2)}</td>
                  <td className="text-right py-1.5 px-1 text-dark-700 dark:text-dark-300">{stats.first_9_average > 0 ? stats.first_9_average.toFixed(2) : '-'}</td>
                  <td className="text-right py-1.5 px-1 text-dark-700 dark:text-dark-300">{(stats.best_leg_average * 3).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardTitle className="text-sm">Pont</CardTitle>
        <div className="mt-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dark-200 dark:border-dark-700">
                <th className="text-left py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">Játékos</th>
                <th className="text-right py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">60+</th>
                <th className="text-right py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">100+</th>
                <th className="text-right py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">140+</th>
                <th className="text-right py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">180</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.map((stats, idx) => (
                <tr key={stats.player_id} className="border-b border-dark-100 dark:border-dark-800 last:border-0">
                  <td className="py-1.5 px-1 font-medium text-dark-900 dark:text-white">{idx + 1}. {stats.display_name}</td>
                  <td className="text-right py-1.5 px-1 text-dark-700 dark:text-dark-300">{stats.visits_60_plus}</td>
                  <td className="text-right py-1.5 px-1 text-dark-700 dark:text-dark-300">{stats.visits_100_plus}</td>
                  <td className="text-right py-1.5 px-1 text-dark-700 dark:text-dark-300">{stats.visits_140_plus}</td>
                  <td className="text-right py-1.5 px-1 font-semibold text-dark-900 dark:text-white">{stats.total_180s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardTitle className="text-sm">Checkout</CardTitle>
        <div className="mt-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dark-200 dark:border-dark-700">
                <th className="text-left py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">Játékos</th>
                <th className="text-right py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">Max Checkout</th>
                <th className="text-right py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">Min Darts</th>
                <th className="text-right py-1.5 px-1 text-dark-600 dark:text-dark-400 font-medium">Checkout %</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.map((stats, idx) => (
                <tr key={stats.player_id} className="border-b border-dark-100 dark:border-dark-800 last:border-0">
                  <td className="py-1.5 px-1 font-medium text-dark-900 dark:text-white">{idx + 1}. {stats.display_name}</td>
                  <td className="text-right py-1.5 px-1 text-dark-700 dark:text-dark-300">{stats.highest_checkout}</td>
                  <td className="text-right py-1.5 px-1 text-dark-700 dark:text-dark-300">{stats.min_darts_leg > 0 ? stats.min_darts_leg : '-'}</td>
                  <td className="text-right py-1.5 px-1 font-semibold text-dark-900 dark:text-white">{stats.checkout_percentage.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {playerStats.map((stats, idx) => {
        const sectorNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
        const maxHits = Math.max(...Object.values(stats.sector_hits), 1);

        return (
          <Card key={stats.player_id}>
            <CardTitle className="text-sm">{idx + 1}. {stats.display_name}</CardTitle>
            <h3 className="text-xs font-semibold text-dark-700 dark:text-dark-300 mt-2 mb-2">Ütések a szektorban</h3>
            <div className="space-y-0.5">
              {sectorNumbers.map((sector) => {
                const hits = stats.sector_hits[sector] || 0;
                const percentage = (hits / maxHits) * 100;
                return (
                  <div key={sector} className="flex items-center gap-1.5">
                    <div className="w-6 text-[10px] text-dark-600 dark:text-dark-400 text-right font-medium">{sector}</div>
                    <div className="flex-1 h-5 bg-dark-100 dark:bg-dark-800 rounded-sm overflow-hidden relative">
                      <div
                        className="h-full bg-success-500 transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                      {hits > 0 && (
                        <div className="absolute inset-0 flex items-center justify-end px-1.5">
                          <span className="text-[10px] font-bold text-dark-900 dark:text-white drop-shadow">{hits}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => navigate('/game-history')}
          className="flex-1 py-2.5 px-4 bg-success-500 hover:bg-success-600 text-white rounded-lg font-semibold transition-colors text-sm"
        >
          Folytatni
        </button>
        <button
          onClick={() => navigate('/game-history')}
          className="flex-1 py-2.5 px-4 bg-error-500 hover:bg-error-600 text-white rounded-lg font-semibold transition-colors text-sm"
        >
          Töröl
        </button>
      </div>
    </div>
  );
}
