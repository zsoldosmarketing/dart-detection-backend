import { useState, useEffect } from 'react';
import { Clock, Wifi, WifiOff, AlertCircle, RefreshCw, Flag } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { supabase } from '../../lib/supabase';

interface OnlineGameControlsProps {
  roomId: string;
  currentUserId: string | null;
  currentPlayerUserId: string | null;
  gameMode: 'bot' | 'pvp' | 'local';
  onSurrender: () => void;
  onPause: () => void;
  turnStartedAt: string | null;
}

export function OnlineGameControls({
  roomId,
  currentUserId,
  currentPlayerUserId,
  gameMode,
  onSurrender,
  onPause,
  turnStartedAt,
}: OnlineGameControlsProps) {
  const [turnTimeRemaining, setTurnTimeRemaining] = useState<number>(60);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [opponentConnected, setOpponentConnected] = useState(true);
  const [showDisconnectWarning, setShowDisconnectWarning] = useState(false);
  const [disconnectTimeRemaining, setDisconnectTimeRemaining] = useState<number>(180);

  useEffect(() => {
    setIsMyTurn(currentUserId === currentPlayerUserId);
  }, [currentUserId, currentPlayerUserId]);

  useEffect(() => {
    if (gameMode !== 'pvp' || !turnStartedAt) return;

    const calculateTimeRemaining = () => {
      const elapsed = Math.floor((Date.now() - new Date(turnStartedAt).getTime()) / 1000);
      return Math.max(0, 60 - elapsed);
    };

    setTurnTimeRemaining(calculateTimeRemaining());

    const timer = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTurnTimeRemaining(remaining);

      if (remaining === 0 && isMyTurn) {
        // Auto-skip turn after 1 minute
        handleTurnTimeout();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [turnStartedAt, isMyTurn, gameMode]);

  useEffect(() => {
    if (gameMode !== 'pvp') return;

    const checkOpponentConnection = async () => {
      const { data: players } = await supabase
        .from('game_players')
        .select('user_id, is_connected, last_seen_at')
        .eq('room_id', roomId);

      if (players) {
        const opponent = players.find((p) => p.user_id !== currentUserId);
        if (opponent) {
          setOpponentConnected(opponent.is_connected || false);

          if (!opponent.is_connected) {
            setShowDisconnectWarning(true);
            if (opponent.last_seen_at) {
              const elapsed = Math.floor(
                (Date.now() - new Date(opponent.last_seen_at).getTime()) / 1000
              );
              setDisconnectTimeRemaining(Math.max(0, 180 - elapsed));
            }
          } else {
            setShowDisconnectWarning(false);
          }
        }
      }
    };

    checkOpponentConnection();
    const interval = setInterval(checkOpponentConnection, 5000);

    return () => clearInterval(interval);
  }, [roomId, currentUserId, gameMode]);

  useEffect(() => {
    if (!showDisconnectWarning) return;

    const timer = setInterval(() => {
      setDisconnectTimeRemaining((prev) => {
        if (prev <= 1) {
          setShowDisconnectWarning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showDisconnectWarning]);

  const handleTurnTimeout = async () => {
    // Auto-skip turn - score 0 for this turn
    await supabase
      .from('game_events')
      .insert({
        room_id: roomId,
        user_id: currentUserId,
        event_type: 'turn_timeout',
        event_data: { reason: 'exceeded_time_limit' },
      });

    // This would trigger the game logic to skip the turn
    // Implementation depends on how your game logic is structured
  };

  if (gameMode !== 'pvp') {
    return null;
  }

  const getTurnTimeColor = () => {
    if (turnTimeRemaining > 30) return 'text-success-600';
    if (turnTimeRemaining > 10) return 'text-warning-600';
    return 'text-error-600';
  };

  return (
    <div className="space-y-3">
      {showDisconnectWarning && (
        <Card className="border-2 border-warning-500/30 bg-warning-50/50 dark:bg-warning-900/10 animate-fade-in">
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-warning-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-dark-900 dark:text-white text-sm">
                Ellenfél lecsatlakozott
              </h4>
              <p className="text-xs text-dark-600 dark:text-dark-400">
                Maximum {Math.floor(disconnectTimeRemaining / 60)} perc {disconnectTimeRemaining % 60} másodperc várakozás
              </p>
            </div>
            <Badge variant="warning" size="sm">
              {Math.floor(disconnectTimeRemaining / 60)}:{(disconnectTimeRemaining % 60).toString().padStart(2, '0')}
            </Badge>
          </div>
        </Card>
      )}

      {isMyTurn && (
        <Card className="border-2 border-primary-500/30 bg-primary-50/50 dark:bg-primary-900/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className={`w-5 h-5 ${getTurnTimeColor()}`} />
              <span className="text-sm font-medium text-dark-700 dark:text-dark-300">
                Körödben
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-bold font-mono ${getTurnTimeColor()}`}>
                {turnTimeRemaining}s
              </span>
              {turnTimeRemaining <= 10 && turnTimeRemaining > 0 && (
                <div className="w-2 h-2 bg-error-500 rounded-full animate-pulse" />
              )}
            </div>
          </div>
          {turnTimeRemaining <= 10 && (
            <div className="mt-2 text-xs text-error-600 dark:text-error-400">
              Figyelj! Az idő hamarosan lejár!
            </div>
          )}
        </Card>
      )}

      {!isMyTurn && (
        <Card className="bg-dark-50 dark:bg-dark-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {opponentConnected ? (
                <Wifi className="w-5 h-5 text-success-600" />
              ) : (
                <WifiOff className="w-5 h-5 text-warning-600" />
              )}
              <span className="text-sm font-medium text-dark-600 dark:text-dark-400">
                Ellenfél körében
              </span>
            </div>
            <Badge variant={opponentConnected ? 'success' : 'warning'} size="sm">
              {opponentConnected ? 'Online' : 'Offline'}
            </Badge>
          </div>
        </Card>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          leftIcon={<RefreshCw className="w-4 h-4" />}
          onClick={onPause}
          className="flex-1"
        >
          Szünet
        </Button>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Flag className="w-4 h-4" />}
          onClick={onSurrender}
          className="flex-1 text-error-600 hover:bg-error-50 dark:hover:bg-error-900/10"
        >
          Feladás
        </Button>
      </div>
    </div>
  );
}
