import { supabase } from './supabase';
import type { DartTarget, DartThrow } from './dartsEngine';

export interface StatTrackingContext {
  playerId: string;
  roomId: string;
  matchId?: string;
  legNumber: number;
  setNumber: number;
  visitNumber: number;
  gameType: 'x01' | 'cricket' | 'around_the_clock' | 'training';
  startingScore?: number;
  isStartingPlayer: boolean;
  opponentRemaining?: number;
}

export interface LegStats {
  playerId: string;
  roomId: string;
  matchId?: string;
  setNumber: number;
  legNumber: number;
  gameType: string;
  startingScore: number;
  wasStartingPlayer: boolean;
  won: boolean;
  totalDarts: number;
  totalScore: number;
  totalVisits: number;
  threeDartAverage: number;
  first9Average?: number;
  first6Average?: number;
  first3Average?: number;
  visits180: number;
  visits171_179: number;
  visits160_170: number;
  visits140_159: number;
  visits120_139: number;
  visits100_119: number;
  visits80_99: number;
  visits60_79: number;
  visits40_59: number;
  visits20_39: number;
  visits0_19: number;
  visitsBust: number;
  visits60Plus: number;
  visits100Plus: number;
  visits140Plus: number;
  highestVisit: number;
  longest100PlusStreak: number;
  doublesHit: number;
  doublesThrown: number;
  triplesHit: number;
  triplesThrown: number;
  checkoutScore?: number;
  checkoutDarts?: number;
  dartsAtDouble: number;
  durationSeconds?: number;
  sectorHits: Record<string, number>;
  minDartsLeg: number;
}

export interface MatchStats {
  playerId: string;
  roomId: string;
  opponentId?: string;
  gameType: string;
  gameMode: 'bot' | 'pvp' | 'local';
  startingScore: number;
  won: boolean;
  setsWon: number;
  setsLost: number;
  legsWon: number;
  legsLost: number;
  matchAverage: number;
  bestLegAverage: number;
  worstLegAverage: number;
  total180s: number;
  total171Plus: number;
  total160Plus: number;
  total140Plus: number;
  total100Plus: number;
  totalDoublesHit: number;
  totalDoublesThrown: number;
  totalTriplesHit: number;
  totalTriplesThrown: number;
  checkoutsHit: number;
  checkoutAttempts: number;
  highestCheckout: number;
  holds: number;
  breaks: number;
  durationSeconds?: number;
}

export async function recordDartThrow(
  context: StatTrackingContext,
  dartNumber: number,
  turnId: string | null,
  target: DartTarget,
  score: number,
  remainingBefore: number,
  remainingAfter: number,
  isBust: boolean,
  isCheckoutAttempt: boolean,
  isSuccessfulCheckout: boolean
): Promise<void> {
  try {
    const { sector, type } = getDartDetails(target);
    const multiplier = getMultiplierFromType(type);

    await supabase.from('dart_throws').insert({
      player_id: context.playerId,
      room_id: context.roomId,
      turn_id: turnId,
      match_id: context.matchId,
      set_number: context.setNumber,
      leg_number: context.legNumber,
      visit_number: context.visitNumber,
      dart_number: dartNumber,
      game_type: context.gameType,
      sector,
      multiplier,
      score,
      remaining_before: remainingBefore,
      remaining_after: remainingAfter,
      is_bust: isBust,
      is_checkout_attempt: isCheckoutAttempt,
      is_successful_checkout: isSuccessfulCheckout,
      is_starting_player: context.isStartingPlayer,
      opponent_remaining: context.opponentRemaining,
      is_pressure_situation: context.opponentRemaining ? context.opponentRemaining <= 170 : false,
    });
  } catch (error) {
    console.error('Failed to record dart throw:', error);
  }
}

export async function recordLegStatistics(legStats: LegStats): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('leg_statistics')
      .insert({
        player_id: legStats.playerId,
        room_id: legStats.roomId,
        match_id: legStats.matchId,
        set_number: legStats.setNumber,
        leg_number: legStats.legNumber,
        game_type: legStats.gameType,
        starting_score: legStats.startingScore,
        was_starting_player: legStats.wasStartingPlayer,
        won: legStats.won,
        total_darts: legStats.totalDarts,
        total_score: legStats.totalScore,
        total_visits: legStats.totalVisits,
        three_dart_average: legStats.threeDartAverage,
        first_9_average: legStats.first9Average,
        first_6_average: legStats.first6Average,
        first_3_average: legStats.first3Average,
        visits_180: legStats.visits180,
        visits_171_179: legStats.visits171_179,
        visits_160_170: legStats.visits160_170,
        visits_140_159: legStats.visits140_159,
        visits_120_139: legStats.visits120_139,
        visits_100_119: legStats.visits100_119,
        visits_80_99: legStats.visits80_99,
        visits_60_79: legStats.visits60_79,
        visits_40_59: legStats.visits40_59,
        visits_20_39: legStats.visits20_39,
        visits_0_19: legStats.visits0_19,
        visits_bust: legStats.visitsBust,
        visits_60_plus: legStats.visits60Plus,
        visits_100_plus: legStats.visits100Plus,
        visits_140_plus: legStats.visits140Plus,
        highest_visit: legStats.highestVisit,
        longest_100plus_streak: legStats.longest100PlusStreak,
        doubles_hit: legStats.doublesHit,
        doubles_thrown: legStats.doublesThrown,
        triples_hit: legStats.triplesHit,
        triples_thrown: legStats.triplesThrown,
        checkout_score: legStats.checkoutScore,
        checkout_darts: legStats.checkoutDarts,
        darts_at_double: legStats.dartsAtDouble,
        duration_seconds: legStats.durationSeconds,
        sector_hits: legStats.sectorHits,
        min_darts_leg: legStats.minDartsLeg,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data?.id || null;
  } catch (error) {
    console.error('Failed to record leg statistics:', error);
    return null;
  }
}

export async function recordCheckoutAttempt(
  playerId: string,
  roomId: string,
  legStatId: string | null,
  checkoutValue: number,
  wasSuccessful: boolean,
  dartsUsed: number,
  targetDouble?: string,
  doublesHit?: number,
  doublesMissed?: number,
  isMatchWinning?: boolean,
  isLegWinning?: boolean,
  isSetWinning?: boolean,
  opponentRemaining?: number,
  checkoutRoute?: string
): Promise<void> {
  try {
    await supabase.from('checkout_attempts').insert({
      player_id: playerId,
      room_id: roomId,
      leg_stat_id: legStatId,
      checkout_value: checkoutValue,
      was_successful: wasSuccessful,
      darts_used: dartsUsed,
      target_double: targetDouble,
      doubles_hit: doublesHit,
      doubles_missed: doublesMissed,
      is_match_winning: isMatchWinning,
      is_leg_winning: isLegWinning,
      is_set_winning: isSetWinning,
      opponent_remaining: opponentRemaining,
      is_under_pressure: opponentRemaining ? opponentRemaining <= 100 : false,
      checkout_route: checkoutRoute,
    });
  } catch (error) {
    console.error('Failed to record checkout attempt:', error);
  }
}

export async function recordMatchStatistics(matchStats: MatchStats): Promise<void> {
  try {
    await supabase.from('match_statistics').insert({
      player_id: matchStats.playerId,
      room_id: matchStats.roomId,
      opponent_id: matchStats.opponentId,
      game_type: matchStats.gameType,
      game_mode: matchStats.gameMode,
      starting_score: matchStats.startingScore,
      won: matchStats.won,
      sets_won: matchStats.setsWon,
      sets_lost: matchStats.setsLost,
      legs_won: matchStats.legsWon,
      legs_lost: matchStats.legsLost,
      match_average: matchStats.matchAverage,
      best_leg_average: matchStats.bestLegAverage,
      worst_leg_average: matchStats.worstLegAverage,
      total_180s: matchStats.total180s,
      total_171_plus: matchStats.total171Plus,
      total_160_plus: matchStats.total160Plus,
      total_140_plus: matchStats.total140Plus,
      total_100_plus: matchStats.total100Plus,
      total_doubles_hit: matchStats.totalDoublesHit,
      total_doubles_thrown: matchStats.totalDoublesThrown,
      total_triples_hit: matchStats.totalTriplesHit,
      total_triples_thrown: matchStats.totalTriplesThrown,
      checkouts_hit: matchStats.checkoutsHit,
      checkout_attempts: matchStats.checkoutAttempts,
      highest_checkout: matchStats.highestCheckout,
      holds: matchStats.holds,
      breaks: matchStats.breaks,
      duration_seconds: matchStats.durationSeconds,
    });

    await updatePlayerStatisticsSummary(matchStats.playerId);
  } catch (error) {
    console.error('Failed to record match statistics:', error);
  }
}

export async function updatePlayerStatisticsSummary(playerId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('update_player_statistics_summary', {
      p_player_id: playerId,
    });

    if (error) throw error;
  } catch (error) {
    console.error('Failed to update player statistics summary:', error);
  }
}

export function calculateLegStats(
  allThrows: DartThrow[],
  startingScore: number,
  won: boolean
): Partial<LegStats> {
  if (allThrows.length === 0) {
    return {
      totalDarts: 0,
      totalScore: 0,
      totalVisits: 0,
      threeDartAverage: 0,
      visits180: 0,
      visits171_179: 0,
      visits160_170: 0,
      visits140_159: 0,
      visits120_139: 0,
      visits100_119: 0,
      visits80_99: 0,
      visits60_79: 0,
      visits40_59: 0,
      visits20_39: 0,
      visits0_19: 0,
      visitsBust: 0,
      visits60Plus: 0,
      visits100Plus: 0,
      visits140Plus: 0,
      highestVisit: 0,
      longest100PlusStreak: 0,
      doublesHit: 0,
      doublesThrown: 0,
      triplesHit: 0,
      triplesThrown: 0,
      dartsAtDouble: 0,
      sectorHits: {},
      minDartsLeg: 0,
    };
  }

  const totalScore = allThrows.reduce((sum, t) => sum + t.score, 0);
  const totalDarts = allThrows.length;

  const visits: number[] = [];
  for (let i = 0; i < allThrows.length; i += 3) {
    const visitDarts = allThrows.slice(i, i + 3);
    const visitScore = visitDarts.reduce((s, d) => s + d.score, 0);
    visits.push(visitScore);
  }

  const threeDartAverage = (totalScore / totalDarts) * 3;
  const first3Darts = allThrows.slice(0, 3);
  const first6Darts = allThrows.slice(0, 6);
  const first9Darts = allThrows.slice(0, 9);

  const first3Average = first3Darts.length === 3
    ? (first3Darts.reduce((s, d) => s + d.score, 0) / 3) * 3
    : undefined;
  const first6Average = first6Darts.length === 6
    ? (first6Darts.reduce((s, d) => s + d.score, 0) / 6) * 3
    : undefined;
  const first9Average = first9Darts.length === 9
    ? (first9Darts.reduce((s, d) => s + d.score, 0) / 9) * 3
    : undefined;

  let visits180 = 0, visits171_179 = 0, visits160_170 = 0, visits140_159 = 0;
  let visits120_139 = 0, visits100_119 = 0, visits80_99 = 0, visits60_79 = 0;
  let visits40_59 = 0, visits20_39 = 0, visits0_19 = 0;
  let highestVisit = 0;
  let current100Streak = 0, longest100PlusStreak = 0;

  visits.forEach((v) => {
    if (v === 180) visits180++;
    else if (v >= 171) visits171_179++;
    else if (v >= 160) visits160_170++;
    else if (v >= 140) visits140_159++;
    else if (v >= 120) visits120_139++;
    else if (v >= 100) visits100_119++;
    else if (v >= 80) visits80_99++;
    else if (v >= 60) visits60_79++;
    else if (v >= 40) visits40_59++;
    else if (v >= 20) visits20_39++;
    else visits0_19++;

    if (v > highestVisit) highestVisit = v;

    if (v >= 100) {
      current100Streak++;
      if (current100Streak > longest100PlusStreak) {
        longest100PlusStreak = current100Streak;
      }
    } else {
      current100Streak = 0;
    }
  });

  let doublesHit = 0, doublesThrown = 0, triplesHit = 0, triplesThrown = 0, dartsAtDouble = 0;
  const sectorHits: Record<string, number> = {};

  allThrows.forEach((dartThrow) => {
    const target = dartThrow.target;
    if (typeof target === 'string') return;

    const sectorNum = target.type === 'single-bull' || target.type === 'double-bull' ? 25 : target.sector;
    sectorHits[sectorNum] = (sectorHits[sectorNum] || 0) + 1;

    if (target.type === 'double' || target.type === 'double-bull') {
      doublesThrown++;
      dartsAtDouble++;
      if (dartThrow.score > 0) doublesHit++;
    }

    if (target.type === 'triple') {
      triplesThrown++;
      if (dartThrow.score > 0) triplesHit++;
    }
  });

  const visits60Plus = visits.filter(v => v >= 60).length;
  const visits100Plus = visits.filter(v => v >= 100).length;
  const visits140Plus = visits.filter(v => v >= 140).length;

  return {
    totalDarts,
    totalScore,
    totalVisits: visits.length,
    threeDartAverage,
    first3Average,
    first6Average,
    first9Average,
    visits180,
    visits171_179,
    visits160_170,
    visits140_159,
    visits120_139,
    visits100_119,
    visits80_99,
    visits60_79,
    visits40_59,
    visits20_39,
    visits0_19,
    visitsBust: 0,
    visits60Plus,
    visits100Plus,
    visits140Plus,
    highestVisit,
    longest100PlusStreak,
    doublesHit,
    doublesThrown,
    triplesHit,
    triplesThrown,
    dartsAtDouble,
    sectorHits,
    minDartsLeg: totalDarts,
  };
}

function getDartDetails(target: DartTarget): { sector: number; type: string } {
  if (typeof target === 'string') {
    return { sector: 0, type: 'MISS' };
  }

  if (target.type === 'double-bull') {
    return { sector: 25, type: 'BULL' };
  }

  if (target.type === 'single-bull') {
    return { sector: 25, type: 'OUTER_BULL' };
  }

  if (target.type === 'miss') {
    return { sector: 0, type: 'MISS' };
  }

  const typeMap: Record<string, string> = {
    single: 'S',
    double: 'D',
    triple: 'T',
  };

  return {
    sector: target.sector,
    type: typeMap[target.type] || 'S',
  };
}

function getMultiplierFromType(type: string): 'S' | 'D' | 'T' | 'BULL' | 'OUTER_BULL' | 'MISS' {
  const map: Record<string, 'S' | 'D' | 'T' | 'BULL' | 'OUTER_BULL' | 'MISS'> = {
    'S': 'S',
    'D': 'D',
    'T': 'T',
    'BULL': 'BULL',
    'OUTER_BULL': 'OUTER_BULL',
    'MISS': 'MISS',
  };
  return map[type] || 'MISS';
}
