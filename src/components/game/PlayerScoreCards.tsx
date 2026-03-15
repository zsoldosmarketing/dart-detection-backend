import { memo } from 'react';
import { Card } from '../ui/Card';
import { t } from '../../lib/i18n';
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

export interface PlayerMatchStats {
  dartsThrown: number;
  totalScore: number;
  visits: number;
  lastVisitScore: number;
  highestVisit: number;
  first9Darts: number[];
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
  playerMatchStats?: Record<string, PlayerMatchStats>;
}

function getAverage(stats: PlayerMatchStats | undefined): string {
  if (!stats || stats.dartsThrown === 0) return '-';
  return ((stats.totalScore / stats.dartsThrown) * 3).toFixed(1);
}

function getFirst9Avg(stats: PlayerMatchStats | undefined): string {
  if (!stats || stats.first9Darts.length === 0) return '-';
  const sum = stats.first9Darts.reduce((a, b) => a + b, 0);
  return ((sum / Math.min(stats.first9Darts.length, 9)) * 3).toFixed(1);
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-dark-400 dark:text-dark-500">{label}</span>
      <span className="text-[11px] font-semibold text-dark-700 dark:text-dark-300" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  );
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
  playerMatchStats,
}: PlayerScoreCardsProps) {

  if (players.length <= 2) {
    return (
      <div className="shrink-0 grid grid-cols-2 gap-2">
        {players.map((player) => {
          const isCurrent = player.player_order === gameState.current_player_order;
          const displayScore = isCurrent && player.id === currentPlayerId
            ? currentRemaining
            : player.current_score;
          const stats = playerMatchStats?.[player.id];

          return (
            <Card
              key={player.id}
              padding="none"
              className={`p-2 relative overflow-hidden transition-all duration-300 ${
                isCurrent
                  ? 'ring-2 ring-primary-500/80 shadow-glow-sm'
                  : 'opacity-80'
              }`}
            >
              {isCurrent && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary-500 to-primary-400" />
              )}
              <div className="text-center">
                <p className={`text-[11px] font-medium ${isCurrent ? 'text-primary-600 dark:text-primary-400' : 'text-dark-500 dark:text-dark-400'}`}>
                  {getPlayerName(player)}
                </p>
                <p className="text-3xl font-extrabold text-dark-900 dark:text-white tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {displayScore}
                </p>
                <div className="mt-1 pt-1 border-t border-dark-100 dark:border-dark-700/50 flex items-center justify-center gap-2 text-[10px] text-dark-400 flex-wrap">
                  <span>{t('game.avg_short')}: {getAverage(stats)}</span>
                  <span>{t('game.leg')} {player.legs_won}/{legsToWin}</span>
                  {stats?.lastVisitScore !== undefined && stats.visits > 0 && (
                    <span>{t('game.last_short')}: {stats.lastVisitScore}</span>
                  )}
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
        const stats = playerMatchStats?.[player.id];

        return (
          <Card padding="sm" className="relative overflow-hidden ring-2 ring-primary-500/80 shadow-glow-sm">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary-500 to-primary-400" />
            <div className="text-center">
              <p className="text-xs font-medium text-primary-600 dark:text-primary-400 mb-1">
                {getPlayerName(player)}
              </p>
              <p className="text-4xl sm:text-5xl font-extrabold text-dark-900 dark:text-white tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {displayScore}
              </p>
              <div className="flex items-center justify-center gap-4 mt-2 text-xs text-dark-400">
                <span>{t('game.avg_short')}: {getAverage(stats)}</span>
                <span>{t('game.first9_short')}: {getFirst9Avg(stats)}</span>
                <span>{t('game.leg')} {player.legs_won}/{legsToWin}</span>
              </div>
            </div>
          </Card>
        );
      })()}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {players
          .filter(p => p.player_order !== gameState.current_player_order)
          .map((player) => {
            const stats = playerMatchStats?.[player.id];
            return (
              <Card
                key={player.id}
                padding="none"
                className="p-2 text-center bg-dark-50 dark:bg-dark-800/50"
              >
                <p className="text-[10px] text-dark-500 dark:text-dark-400 mb-1 truncate">
                  {getPlayerName(player)}
                </p>
                <p className="text-2xl font-bold text-dark-700 dark:text-dark-300" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {player.current_score}
                </p>
                <p className="text-[10px] text-dark-400 mt-0.5">
                  {t('game.avg_short')}: {getAverage(stats)} | {player.legs_won}/{legsToWin}
                </p>
              </Card>
            );
          })}
      </div>
    </div>
  );
});
