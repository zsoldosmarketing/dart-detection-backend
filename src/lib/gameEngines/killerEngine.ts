import type { DartTarget } from '../dartsEngine';

export interface KillerPlayer {
  id: string;
  name: string;
  assignedDouble: number | null;
  lives: number;
  isKiller: boolean;
  isEliminated: boolean;
}

export interface KillerGameState {
  players: KillerPlayer[];
  currentPlayerIndex: number;
  phase: 'assignment' | 'playing';
  initialLives: number;
  dartsThrown: number;
  turnDarts: DartTarget[];
  winner: string | null;
  round: number;
}

export function createKillerGame(
  playerNames: string[],
  options: { lives?: number } = {}
): KillerGameState {
  const players: KillerPlayer[] = playerNames.map((name, idx) => ({
    id: `player-${idx}`,
    name,
    assignedDouble: null,
    lives: options.lives || 3,
    isKiller: false,
    isEliminated: false,
  }));

  return {
    players,
    currentPlayerIndex: 0,
    phase: 'assignment',
    initialLives: options.lives || 3,
    dartsThrown: 0,
    turnDarts: [],
    winner: null,
    round: 1,
  };
}

export function processKillerDart(
  state: KillerGameState,
  dart: DartTarget
): {
  state: KillerGameState;
  assigned?: number;
  killedPlayer?: string;
  selfHit?: boolean;
  becameKiller?: boolean;
} {
  const newState = JSON.parse(JSON.stringify(state)) as KillerGameState;
  const currentPlayer = newState.players[newState.currentPlayerIndex];

  newState.turnDarts.push(dart);
  newState.dartsThrown++;

  if (newState.phase === 'assignment') {
    if (dart.startsWith('D') && dart !== 'MISS') {
      const num = parseInt(dart.slice(1));
      const alreadyAssigned = newState.players.some((p) => p.assignedDouble === num);

      if (!alreadyAssigned && currentPlayer.assignedDouble === null) {
        currentPlayer.assignedDouble = num;
        return { state: newState, assigned: num };
      }
    }
    return { state: newState };
  }

  if (dart.startsWith('D') && dart !== 'MISS') {
    const num = parseInt(dart.slice(1));

    if (num === currentPlayer.assignedDouble && !currentPlayer.isKiller) {
      currentPlayer.isKiller = true;
      return { state: newState, becameKiller: true };
    }

    if (currentPlayer.isKiller) {
      const targetPlayer = newState.players.find(
        (p) => p.assignedDouble === num && !p.isEliminated && p.id !== currentPlayer.id
      );

      if (targetPlayer) {
        targetPlayer.lives--;
        if (targetPlayer.lives <= 0) {
          targetPlayer.isEliminated = true;
          return { state: newState, killedPlayer: targetPlayer.id };
        }
        return { state: newState, selfHit: false };
      }

      if (num === currentPlayer.assignedDouble) {
        currentPlayer.lives--;
        if (currentPlayer.lives <= 0) {
          currentPlayer.isEliminated = true;
        }
        return { state: newState, selfHit: true };
      }
    }
  }

  return { state: newState };
}

export function endKillerTurn(state: KillerGameState): KillerGameState {
  const newState = JSON.parse(JSON.stringify(state)) as KillerGameState;

  if (newState.phase === 'assignment') {
    const allAssigned = newState.players.every((p) => p.assignedDouble !== null);
    if (allAssigned) {
      newState.phase = 'playing';
    }
  }

  const alivePlayers = newState.players.filter((p) => !p.isEliminated);
  if (alivePlayers.length === 1) {
    newState.winner = alivePlayers[0].id;
    return newState;
  }

  do {
    newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % newState.players.length;
  } while (newState.players[newState.currentPlayerIndex].isEliminated);

  if (newState.currentPlayerIndex === 0) {
    newState.round++;
  }

  newState.dartsThrown = 0;
  newState.turnDarts = [];

  return newState;
}

export function getKillerLivesDisplay(lives: number, maxLives: number): string {
  return '❤️'.repeat(lives) + '🖤'.repeat(maxLives - lives);
}
