import { memo } from 'react';
import { Card } from '../ui/Card';
import type { DartThrow } from '../../lib/dartsEngine';

interface Player {
  id: string;
  user_id: string | null;
  is_bot: boolean;
  player_order: number;
  current_score: number;
  legs_won: number;
  sets_won: number;
  bot_difficulty?: string;
  display_name?: string;
  username?: string;
}

interface GameState {
  current_player_order: number;
  current_leg: number;
  current_set: number;
  darts_thrown_this_turn: number;
  turn_score: number;
}

interface PlayerScoreCardsProps {
  players: Player[];
  gameState: GameState;
  currentPlayerId: string | undefined;
  currentRemaining: number;
  legsToWin: number;
  getPlayerName: (player: Player) => string;
  currentTurnDarts: DartThrow[];
  isMyTurn: boolean;
}

export const PlayerScoreCards = memo(function PlayerScoreCards({
  players,
  gameState,
  currentPlayerId,
  currentRemaining,
  legsToWin,
  getPlayerName,
  currentTurnDarts,
  isMyTurn,
}: PlayerScoreCardsProps) {
  if (players.length <= 2) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {players.map((player) => {
          const isCurrent = player.player_order === gameState.current_player_order;
          const displayScore = isCurrent && player.id === currentPlayerId
            ? currentRemaining
            : player.current_score;

          return (
            <Card
              key={player.id}
              className={`relative overflow-hidden transition-all ${
                isCurrent ? 'ring-2 ring-primary-500' : ''
              }`}
            >
              {isCurrent && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary-500" />
              )}
              <div className="text-center">
                <p className="text-sm text-dark-500 dark:text-dark-400 mb-1">
                  {getPlayerName(player)}
                </p>
                <p className="text-5xl font-bold text-dark-900 dark:text-white">
                  {displayScore}
                </p>
                <div className="flex items-center justify-center gap-4 mt-3 text-sm text-dark-500">
                  <span>Leg: {player.legs_won}/{legsToWin}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {players.find(p => p.player_order === gameState.current_player_order) && (() => {
        const player = players.find(p => p.player_order === gameState.current_player_order)!;
        const displayScore = player.id === currentPlayerId ? currentRemaining : player.current_score;
        return (
          <Card className="relative overflow-hidden ring-2 ring-primary-500">
            <div className="absolute top-0 left-0 right-0 h-1 bg-primary-500" />
            <div className="text-center">
              <p className="text-sm text-dark-500 dark:text-dark-400 mb-1">
                {getPlayerName(player)}
              </p>
              <p className="text-5xl font-bold text-dark-900 dark:text-white">
                {displayScore}
              </p>
              <div className="flex items-center justify-center gap-4 mt-3 text-sm text-dark-500">
                <span>Leg: {player.legs_won}/{legsToWin}</span>
              </div>
            </div>
          </Card>
        );
      })()}

      <div className="grid grid-cols-3 gap-2">
        {players
          .filter(p => p.player_order !== gameState.current_player_order)
          .map((player) => (
            <Card
              key={player.id}
              className="p-2 text-center bg-dark-50 dark:bg-dark-800/50"
            >
              <p className="text-xs text-dark-500 dark:text-dark-400 mb-1 truncate">
                {getPlayerName(player)}
              </p>
              <p className="text-2xl font-bold text-dark-700 dark:text-dark-300">
                {player.current_score}
              </p>
              <p className="text-[10px] text-dark-400 mt-1">
                {player.legs_won}/{legsToWin}
              </p>
            </Card>
          ))}
      </div>
    </div>
  );
});
