import type { DartTarget } from '../dartsEngine';
import { getScore } from '../dartsEngine';

export interface ShanghaiPlayer {
  id: string;
  name: string;
  score: number;
  roundScores: number[];
  isEliminated: boolean;
}

export interface ShanghaiGameState {
  players: ShanghaiPlayer[];
  currentPlayerIndex: number;
  currentRound: number;
  maxRounds: number;
  dartsThrown: number;
  turnDarts: DartTarget[];
  turnScore: number;
  turnHasSingle: boolean;
  turnHasDouble: boolean;
  turnHasTriple: boolean;
  winner: string | null;
  shanghaiWinner: string | null;
}

export function createShanghaiGame(
  playerNames: string[],
  options: { maxRounds?: number } = {}
): ShanghaiGameState {
  const players: ShanghaiPlayer[] = playerNames.map((name, idx) => ({
    id: `player-${idx}`,
    name,
    score: 0,
    roundScores: [],
    isEliminated: false,
  }));

  return {
    players,
    currentPlayerIndex: 0,
    currentRound: 1,
    maxRounds: options.maxRounds || 20,
    dartsThrown: 0,
    turnDarts: [],
    turnScore: 0,
    turnHasSingle: false,
    turnHasDouble: false,
    turnHasTriple: false,
    winner: null,
    shanghaiWinner: null,
  };
}

export function processShanghaiDart(
  state: ShanghaiGameState,
  dart: DartTarget
): { state: ShanghaiGameState; hitTarget: boolean; scoreAdded: number; isShanghai: boolean } {
  const newState = JSON.parse(JSON.stringify(state)) as ShanghaiGameState;
  const targetNumber = newState.currentRound;

  let hitTarget = false;
  let scoreAdded = 0;

  if (dart !== 'MISS' && dart !== 'BULL' && dart !== 'OB') {
    const dartNum = parseInt(dart.slice(1));
    if (dartNum === targetNumber) {
      hitTarget = true;
      scoreAdded = getScore(dart);
      newState.turnScore += scoreAdded;

      if (dart.startsWith('S')) newState.turnHasSingle = true;
      if (dart.startsWith('D')) newState.turnHasDouble = true;
      if (dart.startsWith('T')) newState.turnHasTriple = true;
    }
  }

  newState.turnDarts.push(dart);
  newState.dartsThrown++;

  const isShanghai = newState.turnHasSingle && newState.turnHasDouble && newState.turnHasTriple;

  return { state: newState, hitTarget, scoreAdded, isShanghai };
}

export function checkShanghaiWin(state: ShanghaiGameState): boolean {
  return state.turnHasSingle && state.turnHasDouble && state.turnHasTriple;
}

export function endShanghaiTurn(state: ShanghaiGameState): ShanghaiGameState {
  const newState = JSON.parse(JSON.stringify(state)) as ShanghaiGameState;
  const currentPlayer = newState.players[newState.currentPlayerIndex];

  if (checkShanghaiWin(newState)) {
    newState.shanghaiWinner = currentPlayer.id;
    newState.winner = currentPlayer.id;
    return newState;
  }

  currentPlayer.score += newState.turnScore;
  currentPlayer.roundScores.push(newState.turnScore);

  newState.currentPlayerIndex++;

  if (newState.currentPlayerIndex >= newState.players.length) {
    newState.currentPlayerIndex = 0;
    newState.currentRound++;

    if (newState.currentRound > newState.maxRounds) {
      const maxScore = Math.max(...newState.players.map((p) => p.score));
      const winner = newState.players.find((p) => p.score === maxScore);
      newState.winner = winner?.id || null;
    }
  }

  newState.dartsThrown = 0;
  newState.turnDarts = [];
  newState.turnScore = 0;
  newState.turnHasSingle = false;
  newState.turnHasDouble = false;
  newState.turnHasTriple = false;

  return newState;
}

export function getShanghaiTargetDisplay(round: number): string {
  return `Round ${round}: Hit ${round}s (S${round}, D${round}, T${round})`;
}

export function calculateMaxPossibleScore(round: number): number {
  return round + round * 2 + round * 3;
}
