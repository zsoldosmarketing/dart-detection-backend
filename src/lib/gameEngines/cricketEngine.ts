import type { DartTarget } from '../dartsEngine';
import { getScore } from '../dartsEngine';

export interface CricketPlayer {
  id: string;
  name: string;
  marks: Record<number, number>;
  points: number;
  isEliminated: boolean;
}

export interface CricketGameState {
  players: CricketPlayer[];
  currentPlayerIndex: number;
  targets: number[];
  dartsThrown: number;
  turnDarts: DartTarget[];
  turnMarks: Record<number, number>;
  turnPoints: number;
  isCutthroat: boolean;
  isPointsMode: boolean;
  winner: string | null;
  round: number;
}

const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15, 25];

export function createCricketGame(
  playerNames: string[],
  options: { cutthroat?: boolean; pointsMode?: boolean } = {}
): CricketGameState {
  const players: CricketPlayer[] = playerNames.map((name, idx) => ({
    id: `player-${idx}`,
    name,
    marks: Object.fromEntries(CRICKET_NUMBERS.map((n) => [n, 0])),
    points: 0,
    isEliminated: false,
  }));

  return {
    players,
    currentPlayerIndex: 0,
    targets: CRICKET_NUMBERS,
    dartsThrown: 0,
    turnDarts: [],
    turnMarks: {},
    turnPoints: 0,
    isCutthroat: options.cutthroat || false,
    isPointsMode: options.pointsMode !== false,
    winner: null,
    round: 1,
  };
}

export function getTargetFromDart(dart: DartTarget): { number: number; multiplier: number } | null {
  if (dart === 'MISS') return null;
  if (dart === 'BULL') return { number: 25, multiplier: 2 };
  if (dart === 'OB') return { number: 25, multiplier: 1 };

  const prefix = dart[0];
  const num = parseInt(dart.slice(1));

  if (!CRICKET_NUMBERS.includes(num) && num !== 25) return null;

  const multiplier = prefix === 'T' ? 3 : prefix === 'D' ? 2 : 1;
  return { number: num, multiplier };
}

export function processCricketDart(
  state: CricketGameState,
  dart: DartTarget
): { state: CricketGameState; marksAdded: number; pointsScored: number; numberClosed: number | null } {
  const newState = JSON.parse(JSON.stringify(state)) as CricketGameState;
  const currentPlayer = newState.players[newState.currentPlayerIndex];

  const target = getTargetFromDart(dart);
  let marksAdded = 0;
  let pointsScored = 0;
  let numberClosed: number | null = null;

  if (target && CRICKET_NUMBERS.includes(target.number)) {
    const existingMarks = currentPlayer.marks[target.number];
    const marksNeeded = Math.max(0, 3 - existingMarks);
    marksAdded = Math.min(target.multiplier, marksNeeded);
    const excessMarks = target.multiplier - marksAdded;

    currentPlayer.marks[target.number] = existingMarks + marksAdded;

    if (currentPlayer.marks[target.number] >= 3) {
      numberClosed = target.number;

      if (excessMarks > 0 && newState.isPointsMode) {
        const isClosedByAll = newState.players.every((p) => p.marks[target.number] >= 3);

        if (!isClosedByAll) {
          const pointValue = target.number * excessMarks;

          if (newState.isCutthroat) {
            newState.players.forEach((p, idx) => {
              if (idx !== newState.currentPlayerIndex && p.marks[target.number] < 3) {
                p.points += pointValue;
                pointsScored += pointValue;
              }
            });
          } else {
            currentPlayer.points += pointValue;
            pointsScored = pointValue;
          }
        }
      }
    } else if (newState.isPointsMode && existingMarks >= 3 && excessMarks === target.multiplier) {
      const isClosedByAll = newState.players.every((p) => p.marks[target.number] >= 3);

      if (!isClosedByAll) {
        const pointValue = target.number * target.multiplier;

        if (newState.isCutthroat) {
          newState.players.forEach((p, idx) => {
            if (idx !== newState.currentPlayerIndex && p.marks[target.number] < 3) {
              p.points += pointValue;
              pointsScored += pointValue;
            }
          });
        } else {
          currentPlayer.points += pointValue;
          pointsScored = pointValue;
        }
      }
    }

    newState.turnMarks[target.number] = (newState.turnMarks[target.number] || 0) + marksAdded;
    newState.turnPoints += pointsScored;
  }

  newState.turnDarts.push(dart);
  newState.dartsThrown++;

  return { state: newState, marksAdded, pointsScored, numberClosed };
}

export function endCricketTurn(state: CricketGameState): CricketGameState {
  const newState = JSON.parse(JSON.stringify(state)) as CricketGameState;

  const winner = checkCricketWinner(newState);
  if (winner) {
    newState.winner = winner;
    return newState;
  }

  newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % newState.players.length;
  if (newState.currentPlayerIndex === 0) {
    newState.round++;
  }
  newState.dartsThrown = 0;
  newState.turnDarts = [];
  newState.turnMarks = {};
  newState.turnPoints = 0;

  return newState;
}

export function checkCricketWinner(state: CricketGameState): string | null {
  const playersWithAllClosed = state.players.filter((p) =>
    CRICKET_NUMBERS.every((n) => p.marks[n] >= 3)
  );

  if (playersWithAllClosed.length === 0) return null;

  if (state.isCutthroat) {
    const lowestPoints = Math.min(...playersWithAllClosed.map((p) => p.points));
    const winner = playersWithAllClosed.find((p) => p.points === lowestPoints);
    return winner?.id || null;
  } else {
    const highestPoints = Math.max(...playersWithAllClosed.map((p) => p.points));
    const winner = playersWithAllClosed.find((p) => p.points === highestPoints);
    return winner?.id || null;
  }
}

export function getCricketMarksDisplay(marks: number): string {
  switch (marks) {
    case 0: return '';
    case 1: return '/';
    case 2: return 'X';
    default: return 'O';
  }
}
