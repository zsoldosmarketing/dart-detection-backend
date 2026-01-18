import type { DartTarget } from '../dartsEngine';
import { getScore } from '../dartsEngine';

export interface KnockoutPlayer {
  id: string;
  name: string;
  score: number;
  roundScores: number[];
  isEliminated: boolean;
  eliminatedRound: number | null;
}

export interface KnockoutGameState {
  players: KnockoutPlayer[];
  currentPlayerIndex: number;
  currentRound: number;
  dartsThrown: number;
  turnDarts: DartTarget[];
  turnScore: number;
  roundComplete: boolean;
  winner: string | null;
  eliminationMode: 'lowest' | 'below_average';
}

export function createKnockoutGame(
  playerNames: string[],
  options: { eliminationMode?: 'lowest' | 'below_average' } = {}
): KnockoutGameState {
  const players: KnockoutPlayer[] = playerNames.map((name, idx) => ({
    id: `player-${idx}`,
    name,
    score: 0,
    roundScores: [],
    isEliminated: false,
    eliminatedRound: null,
  }));

  return {
    players,
    currentPlayerIndex: 0,
    currentRound: 1,
    dartsThrown: 0,
    turnDarts: [],
    turnScore: 0,
    roundComplete: false,
    winner: null,
    eliminationMode: options.eliminationMode || 'lowest',
  };
}

export function processKnockoutDart(
  state: KnockoutGameState,
  dart: DartTarget
): { state: KnockoutGameState; scoreAdded: number } {
  const newState = JSON.parse(JSON.stringify(state)) as KnockoutGameState;
  const scoreAdded = getScore(dart);

  newState.turnScore += scoreAdded;
  newState.turnDarts.push(dart);
  newState.dartsThrown++;

  return { state: newState, scoreAdded };
}

export function endKnockoutTurn(state: KnockoutGameState): KnockoutGameState {
  const newState = JSON.parse(JSON.stringify(state)) as KnockoutGameState;
  const currentPlayer = newState.players[newState.currentPlayerIndex];

  currentPlayer.score += newState.turnScore;
  currentPlayer.roundScores.push(newState.turnScore);

  let nextPlayerIndex = newState.currentPlayerIndex + 1;
  while (nextPlayerIndex < newState.players.length && newState.players[nextPlayerIndex].isEliminated) {
    nextPlayerIndex++;
  }

  if (nextPlayerIndex >= newState.players.length) {
    newState.roundComplete = true;
    return processRoundEnd(newState);
  }

  newState.currentPlayerIndex = nextPlayerIndex;
  newState.dartsThrown = 0;
  newState.turnDarts = [];
  newState.turnScore = 0;

  return newState;
}

function processRoundEnd(state: KnockoutGameState): KnockoutGameState {
  const newState = JSON.parse(JSON.stringify(state)) as KnockoutGameState;
  const activePlayers = newState.players.filter((p) => !p.isEliminated);

  if (activePlayers.length <= 1) {
    if (activePlayers.length === 1) {
      newState.winner = activePlayers[0].id;
    }
    return newState;
  }

  const roundScores = activePlayers.map((p) => p.roundScores[newState.currentRound - 1] || 0);

  if (newState.eliminationMode === 'lowest') {
    const lowestScore = Math.min(...roundScores);
    const playersWithLowest = activePlayers.filter(
      (p) => p.roundScores[newState.currentRound - 1] === lowestScore
    );

    if (playersWithLowest.length < activePlayers.length) {
      playersWithLowest.forEach((p) => {
        const player = newState.players.find((pl) => pl.id === p.id);
        if (player) {
          player.isEliminated = true;
          player.eliminatedRound = newState.currentRound;
        }
      });
    }
  } else {
    const avgScore = roundScores.reduce((a, b) => a + b, 0) / roundScores.length;
    activePlayers.forEach((p) => {
      if ((p.roundScores[newState.currentRound - 1] || 0) < avgScore) {
        const player = newState.players.find((pl) => pl.id === p.id);
        if (player) {
          player.isEliminated = true;
          player.eliminatedRound = newState.currentRound;
        }
      }
    });
  }

  const remainingPlayers = newState.players.filter((p) => !p.isEliminated);
  if (remainingPlayers.length === 1) {
    newState.winner = remainingPlayers[0].id;
    return newState;
  }

  if (remainingPlayers.length === 0) {
    const maxScore = Math.max(...newState.players.map((p) => p.score));
    const winner = newState.players.find((p) => p.score === maxScore);
    newState.winner = winner?.id || null;
    return newState;
  }

  newState.currentRound++;
  newState.roundComplete = false;

  let firstActiveIndex = 0;
  while (firstActiveIndex < newState.players.length && newState.players[firstActiveIndex].isEliminated) {
    firstActiveIndex++;
  }
  newState.currentPlayerIndex = firstActiveIndex;
  newState.dartsThrown = 0;
  newState.turnDarts = [];
  newState.turnScore = 0;

  return newState;
}

export function getKnockoutRoundSummary(state: KnockoutGameState): {
  playerId: string;
  name: string;
  roundScore: number;
  totalScore: number;
  isEliminated: boolean;
}[] {
  return state.players.map((p) => ({
    playerId: p.id,
    name: p.name,
    roundScore: p.roundScores[state.currentRound - 1] || 0,
    totalScore: p.score,
    isEliminated: p.isEliminated,
  }));
}
