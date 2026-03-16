export type DartTarget =
  | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8' | 'S9' | 'S10'
  | 'S11' | 'S12' | 'S13' | 'S14' | 'S15' | 'S16' | 'S17' | 'S18' | 'S19' | 'S20'
  | 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'D8' | 'D9' | 'D10'
  | 'D11' | 'D12' | 'D13' | 'D14' | 'D15' | 'D16' | 'D17' | 'D18' | 'D19' | 'D20'
  | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'T8' | 'T9' | 'T10'
  | 'T11' | 'T12' | 'T13' | 'T14' | 'T15' | 'T16' | 'T17' | 'T18' | 'T19' | 'T20'
  | 'OB' | 'BULL' | 'MISS';

export interface DartThrow {
  target: DartTarget;
  score: number;
}

export interface CheckoutRoute {
  darts: DartTarget[];
  probability: number;
  description: string;
  salvage?: string;
}

export interface SetupSuggestion {
  target: DartTarget;
  leave: number;
  projection: { hit: string; leave: number }[];
  priority: 'high' | 'medium' | 'low';
  preferredPriority?: number;
}

export interface BotParams {
  scoringMean: number;
  scoringSd: number;
  pTripleHit: number;
  pDoubleHit: number;
  pSingleControl: number;
  pBull: number;
  pressureFactor: number;
  riskAppetite: number;
  checkoutKnowledge: number;
}

export const BOT_PRESETS: Record<string, BotParams> = {
  easy: {
    scoringMean: 38,
    scoringSd: 18,
    pTripleHit: 0.18,
    pDoubleHit: 0.12,
    pSingleControl: 0.55,
    pBull: 0.06,
    pressureFactor: 0.9,
    riskAppetite: 0.25,
    checkoutKnowledge: 0.5,
  },
  medium: {
    scoringMean: 52,
    scoringSd: 16,
    pTripleHit: 0.26,
    pDoubleHit: 0.18,
    pSingleControl: 0.65,
    pBull: 0.08,
    pressureFactor: 1.0,
    riskAppetite: 0.4,
    checkoutKnowledge: 0.65,
  },
  hard: {
    scoringMean: 68,
    scoringSd: 14,
    pTripleHit: 0.34,
    pDoubleHit: 0.26,
    pSingleControl: 0.75,
    pBull: 0.10,
    pressureFactor: 1.05,
    riskAppetite: 0.55,
    checkoutKnowledge: 0.8,
  },
  pro: {
    scoringMean: 74,
    scoringSd: 13,
    pTripleHit: 0.35,
    pDoubleHit: 0.32,
    pSingleControl: 0.78,
    pBull: 0.12,
    pressureFactor: 1.1,
    riskAppetite: 0.5,
    checkoutKnowledge: 0.9,
  },
};

export function formatDartDisplay(target: DartTarget | { type: string; sector: number }): string {
  if (typeof target === 'object' && target !== null) {
    const { type, sector } = target;
    if (type === 'miss') return 'Miss';
    if (type === 'double-bull') return 'Bull';
    if (type === 'single-bull') return '25';
    if (type === 'single') return `${sector}`;
    if (type === 'double') return `D${sector}`;
    if (type === 'triple') return `T${sector}`;
    return '-';
  }

  if (typeof target === 'string') {
    if (target === 'MISS') return 'Miss';
    if (target === 'BULL') return 'Bull';
    if (target === 'OB') return '25';
    if (target.startsWith('S')) return target.slice(1);
    return target;
  }

  return '-';
}

export function getScore(target: DartTarget | { type: string; sector: number }): number {
  if (typeof target === 'object' && target !== null) {
    const { type, sector } = target;
    if (type === 'miss') return 0;
    if (type === 'single-bull') return 25;
    if (type === 'double-bull') return 50;
    if (type === 'single') return sector;
    if (type === 'double') return sector * 2;
    if (type === 'triple') return sector * 3;
    return 0;
  }

  if (target === 'MISS') return 0;
  if (target === 'OB') return 25;
  if (target === 'BULL') return 50;

  const prefix = target[0];
  const num = parseInt(target.slice(1));

  switch (prefix) {
    case 'S': return num;
    case 'D': return num * 2;
    case 'T': return num * 3;
    default: return 0;
  }
}

export function parseTarget(input: string): DartTarget | null {
  const normalized = input.toUpperCase().trim();

  if (normalized === 'MISS' || normalized === '0') return 'MISS';
  if (normalized === 'OB' || normalized === '25' || normalized === 'OUTER' || normalized === 'OUTER BULL') return 'OB';
  if (normalized === 'BULL' || normalized === '50' || normalized === 'INNER' || normalized === 'INNER BULL' || normalized === 'DB') return 'BULL';

  const match = normalized.match(/^([SDT])(\d{1,2})$/);
  if (match) {
    const [, prefix, numStr] = match;
    const num = parseInt(numStr);
    if (num >= 1 && num <= 20) {
      return `${prefix}${num}` as DartTarget;
    }
  }

  const numOnly = parseInt(normalized);
  if (!isNaN(numOnly) && numOnly >= 1 && numOnly <= 20) {
    return `S${numOnly}` as DartTarget;
  }

  return null;
}

const PREFERRED_DOUBLES = ['D20', 'D16', 'D8', 'D10', 'D12', 'D18', 'D14', 'D6', 'D4', 'D2'];
const BOGEY_NUMBERS = [169, 168, 166, 165, 163, 162, 159];
const IDEAL_LEAVES = [40, 32, 24, 20, 16, 12, 10, 8, 6, 4, 2];

const CHECKOUT_TABLE: Record<number, DartTarget[][]> = {
  170: [['T20', 'T20', 'BULL']],
  167: [['T20', 'T19', 'BULL'], ['T19', 'T18', 'BULL']],
  164: [['T20', 'T18', 'BULL'], ['T19', 'T19', 'BULL']],
  161: [['T20', 'T17', 'BULL'], ['T20', 'T19', 'D12']],
  160: [['T20', 'T20', 'D20']],
  158: [['T20', 'T20', 'D19']],
  157: [['T20', 'T19', 'D20']],
  156: [['T20', 'T20', 'D18']],
  155: [['T20', 'T19', 'D19']],
  154: [['T20', 'T18', 'D20']],
  153: [['T20', 'T19', 'D18']],
  152: [['T20', 'T20', 'D16']],
  151: [['T20', 'T17', 'D20']],
  150: [['T20', 'T18', 'D18']],
  149: [['T20', 'T19', 'D16']],
  148: [['T20', 'T20', 'D14']],
  147: [['T20', 'T17', 'D18']],
  146: [['T20', 'T18', 'D16']],
  145: [['T20', 'T19', 'D14']],
  144: [['T20', 'T20', 'D12']],
  143: [['T20', 'T17', 'D16']],
  142: [['T20', 'T14', 'D20']],
  141: [['T20', 'T19', 'D12'], ['T19', 'T14', 'D20']],
  140: [['T20', 'T20', 'D10'], ['T20', 'T16', 'D16']],
  139: [['T20', 'T13', 'D20']],
  138: [['T20', 'T18', 'D12']],
  137: [['T20', 'T19', 'D10']],
  136: [['T20', 'T20', 'D8']],
  135: [['T20', 'T17', 'D12']],
  134: [['T20', 'T14', 'D16']],
  133: [['T20', 'T19', 'D8']],
  132: [['T20', 'T16', 'D12']],
  131: [['T20', 'T13', 'D16']],
  130: [['T20', 'T18', 'D8']],
  129: [['T19', 'T16', 'D12']],
  128: [['T18', 'T14', 'D16']],
  127: [['T20', 'T17', 'D8']],
  126: [['T19', 'T19', 'D6']],
  125: [['T20', 'T15', 'D10']],
  124: [['T20', 'T16', 'D8']],
  123: [['T19', 'T16', 'D9']],
  122: [['T18', 'T18', 'D7'], ['T20', 'T10', 'D16']],
  121: [['T20', 'T11', 'D14'], ['T17', 'T20', 'D10'], ['T19', 'T14', 'D10']],
  120: [['T20', 'S20', 'D20'], ['T20', 'D30']],
  119: [['T19', 'T12', 'D13']],
  118: [['T20', 'S18', 'D20']],
  117: [['T20', 'S17', 'D20']],
  116: [['T20', 'S16', 'D20']],
  115: [['T20', 'S15', 'D20']],
  114: [['T20', 'S14', 'D20']],
  113: [['T20', 'S13', 'D20']],
  112: [['T20', 'T12', 'D8']],
  111: [['T20', 'S19', 'D16']],
  110: [['T20', 'S10', 'D20']],
  109: [['T20', 'S9', 'D20']],
  108: [['T20', 'S16', 'D16']],
  107: [['T19', 'S10', 'D20']],
  106: [['T20', 'S6', 'D20']],
  105: [['T20', 'S13', 'D16']],
  104: [['T18', 'S18', 'D16']],
  103: [['T19', 'S6', 'D20']],
  102: [['T20', 'S10', 'D16']],
  101: [['T17', 'S10', 'D20']],
  100: [['T20', 'D20'], ['T18', 'D23'], ['T16', 'D26']],
  99: [['T19', 'S10', 'D16'], ['T19', 'D21']],
  98: [['T20', 'D19'], ['T18', 'D22']],
  97: [['T19', 'D20'], ['T17', 'D23']],
  96: [['T20', 'D18'], ['T16', 'D24']],
  95: [['T19', 'D19'], ['T15', 'D25']],
  94: [['T18', 'D20'], ['T14', 'D23']],
  93: [['T19', 'D18'], ['T17', 'D21']],
  92: [['T20', 'D16'], ['T12', 'D28']],
  91: [['T17', 'D20'], ['T11', 'D29']],
  90: [['T18', 'D18'], ['T20', 'D15']],
  89: [['T19', 'D16'], ['T15', 'D22']],
  88: [['T16', 'D20'], ['T20', 'D14']],
  87: [['T17', 'D18'], ['T13', 'D23']],
  86: [['T18', 'D16'], ['T14', 'D22']],
  85: [['T15', 'D20'], ['T19', 'D14']],
  84: [['T20', 'D12'], ['T16', 'D18']],
  83: [['T17', 'D16'], ['T13', 'D22']],
  82: [['T14', 'D20'], ['BULL', 'D16'], ['T10', 'D26']],
  81: [['T19', 'D12'], ['T15', 'D18']],
  80: [['T20', 'D10'], ['T16', 'D16']],
  79: [['T19', 'D11']],
  78: [['T18', 'D12']],
  77: [['T19', 'D10']],
  76: [['T20', 'D8']],
  75: [['T17', 'D12']],
  74: [['T14', 'D16']],
  73: [['T19', 'D8']],
  72: [['T16', 'D12']],
  71: [['T13', 'D16']],
  70: [['T18', 'D8']],
  69: [['T19', 'D6']],
  68: [['T20', 'D4']],
  67: [['T17', 'D8']],
  66: [['T10', 'D18']],
  65: [['T19', 'D4']],
  64: [['T16', 'D8']],
  63: [['T13', 'D12']],
  62: [['T10', 'D16']],
  61: [['T15', 'D8']],
  60: [['S20', 'D20'], ['S12', 'D24'], ['S8', 'D26']],
  59: [['S19', 'D20'], ['S11', 'D24']],
  58: [['S18', 'D20'], ['S10', 'D24']],
  57: [['S17', 'D20'], ['S9', 'D24']],
  56: [['T16', 'D4'], ['S16', 'D20'], ['S8', 'D24']],
  55: [['S15', 'D20'], ['S7', 'D24']],
  54: [['S14', 'D20'], ['S6', 'D24']],
  53: [['S13', 'D20'], ['S5', 'D24']],
  52: [['T12', 'D8'], ['S12', 'D20'], ['S4', 'D24']],
  51: [['S19', 'D16'], ['S11', 'D20']],
  50: [['S10', 'D20'], ['S18', 'D16'], ['S6', 'D22'], ['BULL']],
  49: [['S9', 'D20'], ['S17', 'D16']],
  48: [['S16', 'D16'], ['S8', 'D20']],
  47: [['S15', 'D16'], ['S7', 'D20']],
  46: [['S6', 'D20'], ['S14', 'D16']],
  45: [['S13', 'D16'], ['S5', 'D20']],
  44: [['S12', 'D16'], ['S4', 'D20']],
  43: [['S11', 'D16'], ['S3', 'D20']],
  42: [['S10', 'D16'], ['S2', 'D20']],
  41: [['S9', 'D16'], ['S1', 'D20']],
  40: [['D20'], ['S8', 'D16'], ['D16', 'D4']],
  39: [['S7', 'D16']],
  38: [['D19']],
  37: [['S5', 'D16']],
  36: [['D18']],
  35: [['S3', 'D16']],
  34: [['D17']],
  33: [['S1', 'D16']],
  32: [['D16']],
  31: [['S15', 'D8']],
  30: [['D15']],
  29: [['S13', 'D8']],
  28: [['D14']],
  27: [['S11', 'D8']],
  26: [['D13']],
  25: [['S9', 'D8']],
  24: [['D12']],
  23: [['S7', 'D8']],
  22: [['D11']],
  21: [['S5', 'D8']],
  20: [['D10']],
  19: [['S3', 'D8']],
  18: [['D9']],
  17: [['S1', 'D8']],
  16: [['D8']],
  15: [['S7', 'D4']],
  14: [['D7']],
  13: [['S5', 'D4']],
  12: [['D6']],
  11: [['S3', 'D4']],
  10: [['D5']],
  9: [['S1', 'D4']],
  8: [['D4']],
  7: [['S3', 'D2']],
  6: [['D3']],
  5: [['S1', 'D2']],
  4: [['D2']],
  3: [['S1', 'D1']],
  2: [['D1']],
};

export function getCheckoutRoutes(
  remaining: number,
  preferredDoubles: number[] | string[] = [20, 16, 8, 10, 12, 18, 14, 6, 4, 2]
): CheckoutRoute[] {
  if (remaining < 2 || remaining > 170) return [];
  if (BOGEY_NUMBERS.includes(remaining)) return [];

  const preferredDoublesStr = preferredDoubles.map(d =>
    typeof d === 'string' ? d : `D${d}`
  );

  const routes: CheckoutRoute[] = [];
  const tableRoutes = CHECKOUT_TABLE[remaining];

  if (tableRoutes) {
    tableRoutes.forEach((route, idx) => {
      const finishingDouble = route.find(dart => dart.startsWith('D'));
      let preferredBonus = 0;

      if (finishingDouble) {
        const preferredIndex = preferredDoublesStr.indexOf(finishingDouble);
        if (preferredIndex >= 0 && preferredIndex < 3) {
          preferredBonus = 0.15 - (preferredIndex * 0.04);
        }
      }

      routes.push({
        darts: route as DartTarget[],
        probability: 0.85 + preferredBonus - idx * 0.08,
        description: route.join(' -> '),
        salvage: getSalvageHint(route as DartTarget[], remaining),
      });
    });
  }

  for (let i = 0; i < Math.min(3, preferredDoublesStr.length); i++) {
    const double = preferredDoublesStr[i];
    const doubleValue = parseInt(double.slice(1)) * 2;
    if (doubleValue === remaining && !routes.some((r) => r.darts.length === 1)) {
      const priorityBonus = 0.10 - (i * 0.03);
      routes.push({
        darts: [double as DartTarget],
        probability: 0.90 + priorityBonus,
        description: double,
      });
    }
  }

  return routes
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 6);
}

function getSalvageHint(route: DartTarget[], remaining: number): string | undefined {
  if (route.length < 2) return undefined;

  const firstDart = route[0];
  const firstScore = getScore(firstDart);

  if (firstDart.startsWith('T')) {
    const singleScore = parseInt(firstDart.slice(1));
    const missLeave = remaining - singleScore;
    if (missLeave >= 2 && missLeave <= 170 && !BOGEY_NUMBERS.includes(missLeave)) {
      return `Ha S${firstDart.slice(1)}: ${missLeave} marad`;
    }
  }

  return undefined;
}

export function isRealCheckoutAttempt(
  remainingBefore: number,
  target: DartTarget,
  doubleOut: boolean
): boolean {
  if (!doubleOut) return remainingBefore <= 170;

  const score = getScore(target);

  if (target === 'BULL') return remainingBefore === 50;
  if (target === 'OB') return remainingBefore === 25;

  if (typeof target === 'string' && target.startsWith('D')) {
    const num = parseInt(target.slice(1));
    return remainingBefore === num * 2;
  }

  if (remainingBefore <= 2) {
    if (target === 'MISS') return false;
    return score === remainingBefore;
  }

  if (remainingBefore <= 40 && remainingBefore % 2 === 0) {
    const halfRemaining = remainingBefore / 2;
    const doubleTarget = `D${halfRemaining}` as DartTarget;
    return target === doubleTarget;
  }

  return false;
}

export function getCheckoutAttemptDetails(
  remainingBefore: number,
  dartTarget: DartTarget,
  doubleOut: boolean
): { isAttempt: boolean; targetDouble: string | null; isBust: boolean } {
  const isAttempt = isRealCheckoutAttempt(remainingBefore, dartTarget, doubleOut);

  let targetDouble: string | null = null;

  if (dartTarget === 'BULL' && remainingBefore === 50) {
    targetDouble = 'BULL';
  } else if (typeof dartTarget === 'string' && dartTarget.startsWith('D')) {
    const num = parseInt(dartTarget.slice(1));
    if (remainingBefore === num * 2) {
      targetDouble = dartTarget;
    }
  }

  const score = getScore(dartTarget);
  const remainingAfter = remainingBefore - score;
  const bustResult = remainingAfter < 0 || remainingAfter === 1 || (doubleOut && remainingAfter > 0 && remainingAfter < 2 && dartTarget !== 'BULL' && !String(dartTarget).startsWith('D'));

  return { isAttempt, targetDouble, isBust: bustResult };
}

export function getSetupSuggestions(
  remaining: number,
  dartsLeft: number = 3,
  preferredDoubles: number[] = [20, 16, 8, 10, 12, 18, 14, 6, 4, 2]
): SetupSuggestion[] {
  if (remaining > 170 || remaining < 2) return [];

  const suggestions: SetupSuggestion[] = [];
  const targets: DartTarget[] = ['T20', 'T19', 'T18', 'T17', 'BULL'];
  const maxCheckouts = [170, 167, 164, 161, 160, 158, 157];

  for (const target of targets) {
    const score = getScore(target);
    const leave = remaining - score;

    if (leave < 2) continue;
    if (BOGEY_NUMBERS.includes(leave)) continue;

    const isMaxCheckout = maxCheckouts.includes(leave);
    const hasCheckout = leave <= 170 && CHECKOUT_TABLE[leave];

    let preferredPriority = -1;
    for (let i = 0; i < Math.min(3, preferredDoubles.length); i++) {
      if (leave === preferredDoubles[i] * 2) {
        preferredPriority = i;
        break;
      }
    }

    const projection: { hit: string; leave: number }[] = [];

    if (target.startsWith('T')) {
      const num = parseInt(target.slice(1));
      projection.push({ hit: `T${num}`, leave });
      projection.push({ hit: `S${num}`, leave: remaining - num });

      const doubleLeave = remaining - (num * 2);
      if (doubleLeave >= 2 && doubleLeave <= 170 && !BOGEY_NUMBERS.includes(doubleLeave)) {
        projection.push({ hit: `D${num}`, leave: doubleLeave });
      }
    } else if (target === 'BULL') {
      projection.push({ hit: 'BULL', leave });
      projection.push({ hit: 'OB', leave: remaining - 25 });
    } else {
      projection.push({ hit: target, leave });
    }

    let priority: 'high' | 'medium' | 'low';
    if (isMaxCheckout || preferredPriority === 0) {
      priority = 'high';
    } else if (preferredPriority === 1 || (hasCheckout && preferredPriority >= 0)) {
      priority = 'high';
    } else if (preferredPriority === 2 || hasCheckout) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    suggestions.push({
      target,
      leave,
      projection,
      priority,
      preferredPriority,
    });
  }

  return suggestions
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }

      const aPreferred = a.preferredPriority ?? 999;
      const bPreferred = b.preferredPriority ?? 999;
      if (aPreferred !== bPreferred) {
        return aPreferred - bPreferred;
      }

      const aIsTriple = a.target.startsWith('T') ? 1 : 0;
      const bIsTriple = b.target.startsWith('T') ? 1 : 0;
      if (aIsTriple !== bIsTriple) {
        return bIsTriple - aIsTriple;
      }
      return a.leave - b.leave;
    })
    .slice(0, 8);
}

export function generateBotThrow(
  remaining: number,
  params: BotParams,
  isCheckoutAttempt: boolean = false
): DartThrow {
  if (remaining <= 170 && isCheckoutAttempt) {
    const routes = getCheckoutRoutes(remaining);
    if (routes.length > 0 && Math.random() < params.checkoutKnowledge) {
      const route = routes[0];
      const targetDart = route.darts[0];

      if (targetDart.startsWith('D')) {
        const hit = Math.random() < params.pDoubleHit * params.pressureFactor;
        if (hit) {
          return { target: targetDart, score: getScore(targetDart) };
        }
        const num = parseInt(targetDart.slice(1));
        return { target: `S${num}` as DartTarget, score: num };
      }

      if (targetDart.startsWith('T')) {
        const hit = Math.random() < params.pTripleHit;
        if (hit) {
          return { target: targetDart, score: getScore(targetDart) };
        }
        const num = parseInt(targetDart.slice(1));
        return { target: `S${num}` as DartTarget, score: num };
      }

      if (targetDart === 'BULL') {
        const hit = Math.random() < params.pBull;
        if (hit) {
          return { target: 'BULL', score: 50 };
        }
        return { target: 'OB', score: 25 };
      }
    }
  }

  const mean = params.scoringMean / 3;
  const sd = params.scoringSd / 3;
  const score = Math.max(0, Math.min(60, gaussianRandom(mean, sd)));

  if (score >= 45 && Math.random() < params.pTripleHit) {
    return { target: 'T20', score: 60 };
  }
  if (score >= 30 && Math.random() < params.pTripleHit * 0.8) {
    return { target: 'T19', score: 57 };
  }

  const roundedScore = Math.round(score);
  if (roundedScore >= 1 && roundedScore <= 20) {
    return { target: `S${roundedScore}` as DartTarget, score: roundedScore };
  }

  return { target: 'S20', score: 20 };
}

function gaussianRandom(mean: number, sd: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return num * sd + mean;
}

function isDouble(target: DartTarget | { type: string; sector: number }): boolean {
  if (typeof target === 'object' && target !== null) {
    return target.type === 'double' || target.type === 'double-bull';
  }
  return typeof target === 'string' && (target.startsWith('D') || target === 'BULL');
}

export function isBust(remaining: number, score: number, lastDart: DartTarget | { type: string; sector: number }): boolean {
  const newRemaining = remaining - score;

  if (newRemaining < 0) return true;
  if (newRemaining === 1) return true;
  if (newRemaining === 0 && !isDouble(lastDart)) return true;

  return false;
}

export function isCheckout(remaining: number, score: number, lastDart: DartTarget | { type: string; sector: number }): boolean {
  return remaining - score === 0 && isDouble(lastDart);
}

export function getBogeyWarning(currentScore: number, dartValue: number): string | null {
  const resultingScore = currentScore - dartValue;

  if (BOGEY_NUMBERS.includes(resultingScore)) {
    return `FIGYELEM! ${dartValue} ponttal ${resultingScore}-re érkezel - ez nem kiszálló! Válts más célra!`;
  }

  if (resultingScore === 1) {
    return `VIGYÁZAT! ${dartValue} ponttal 1-re érkezel - tullepes!`;
  }

  return null;
}
