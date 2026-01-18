import type { DartTarget } from '../dartsEngine';
import { getScore } from '../dartsEngine';

export interface HalveItPlayer {
  id: string;
  name: string;
  score: number;
  roundScores: number[];
  isEliminated: boolean;
}

export interface HalveItTarget {
  type: 'number' | 'double' | 'triple' | 'bull';
  value?: number;
  label: string;
}

export interface HalveItGameState {
  players: HalveItPlayer[];
  currentPlayerIndex: number;
  targets: HalveItTarget[];
  currentTargetIndex: number;
  dartsThrown: number;
  turnDarts: DartTarget[];
  turnScore: number;
  turnHitTarget: boolean;
  winner: string | null;
  round: number;
}

const DEFAULT_TARGETS: HalveItTarget[] = [
  { type: 'number', value: 20, label: '20s' },
  { type: 'number', value: 19, label: '19s' },
  { type: 'double', label: 'Any Double' },
  { type: 'number', value: 18, label: '18s' },
  { type: 'number', value: 17, label: '17s' },
  { type: 'triple', label: 'Any Triple' },
  { type: 'number', value: 16, label: '16s' },
  { type: 'number', value: 15, label: '15s' },
  { type: 'bull', label: 'Bull' },
];

export function createHalveItGame(
  playerNames: string[],
  customTargets?: HalveItTarget[]
): HalveItGameState {
  const players: HalveItPlayer[] = playerNames.map((name, idx) => ({
    id: `player-${idx}`,
    name,
    score: 0,
    roundScores: [],
    isEliminated: false,
  }));

  return {
    players,
    currentPlayerIndex: 0,
    targets: customTargets || DEFAULT_TARGETS,
    currentTargetIndex: 0,
    dartsThrown: 0,
    turnDarts: [],
    turnScore: 0,
    turnHitTarget: false,
    winner: null,
    round: 1,
  };
}

export function checkDartHitsTarget(dart: DartTarget, target: HalveItTarget): { hits: boolean; score: number } {
  if (dart === 'MISS') return { hits: false, score: 0 };

  const score = getScore(dart);

  switch (target.type) {
    case 'number': {
      const num = target.value!;
      const dartNum = dart === 'BULL' ? 25 : dart === 'OB' ? 25 : parseInt(dart.slice(1));
      if (dartNum === num) {
        return { hits: true, score };
      }
      return { hits: false, score: 0 };
    }

    case 'double': {
      if (dart.startsWith('D') || dart === 'BULL') {
        return { hits: true, score };
      }
      return { hits: false, score: 0 };
    }

    case 'triple': {
      if (dart.startsWith('T')) {
        return { hits: true, score };
      }
      return { hits: false, score: 0 };
    }

    case 'bull': {
      if (dart === 'BULL' || dart === 'OB') {
        return { hits: true, score };
      }
      return { hits: false, score: 0 };
    }

    default:
      return { hits: false, score: 0 };
  }
}

export function processHalveItDart(
  state: HalveItGameState,
  dart: DartTarget
): { state: HalveItGameState; hitTarget: boolean; scoreAdded: number } {
  const newState = JSON.parse(JSON.stringify(state)) as HalveItGameState;
  const currentTarget = newState.targets[newState.currentTargetIndex];

  const { hits, score } = checkDartHitsTarget(dart, currentTarget);

  if (hits) {
    newState.turnScore += score;
    newState.turnHitTarget = true;
  }

  newState.turnDarts.push(dart);
  newState.dartsThrown++;

  return { state: newState, hitTarget: hits, scoreAdded: hits ? score : 0 };
}

export function endHalveItTurn(state: HalveItGameState): HalveItGameState {
  const newState = JSON.parse(JSON.stringify(state)) as HalveItGameState;
  const currentPlayer = newState.players[newState.currentPlayerIndex];

  if (newState.turnHitTarget) {
    currentPlayer.score += newState.turnScore;
  } else {
    currentPlayer.score = Math.floor(currentPlayer.score / 2);
  }

  currentPlayer.roundScores.push(newState.turnScore);

  newState.currentPlayerIndex++;

  if (newState.currentPlayerIndex >= newState.players.length) {
    newState.currentPlayerIndex = 0;
    newState.currentTargetIndex++;
    newState.round++;

    if (newState.currentTargetIndex >= newState.targets.length) {
      const maxScore = Math.max(...newState.players.map((p) => p.score));
      const winner = newState.players.find((p) => p.score === maxScore);
      newState.winner = winner?.id || null;
    }
  }

  newState.dartsThrown = 0;
  newState.turnDarts = [];
  newState.turnScore = 0;
  newState.turnHitTarget = false;

  return newState;
}

export function getHalveItTargetDescription(target: HalveItTarget): string {
  switch (target.type) {
    case 'number':
      return `Hit any ${target.value} (single, double, or triple)`;
    case 'double':
      return 'Hit any double or bullseye';
    case 'triple':
      return 'Hit any triple';
    case 'bull':
      return 'Hit outer or inner bull';
    default:
      return '';
  }
}
