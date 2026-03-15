import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Volume2, VolumeX, Skull } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DartScoreInput } from '../components/game/DartScoreInput';
import { getScore } from '../lib/dartsEngine';
import {
  createKnockoutGame,
  processKnockoutDart,
  endKnockoutTurn,
  type KnockoutGameState,
} from '../lib/gameEngines/knockoutEngine';
import { voiceCaller } from '../lib/voiceCaller';
import type { DartTarget } from '../lib/dartsEngine';

export function KnockoutGamePage() {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<KnockoutGameState | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dartQueue, setDartQueue] = useState<DartTarget[]>([]);
  const [eliminatedThisRound, setEliminatedThisRound] = useState<string[]>([]);

  useEffect(() => {
    let players: string[] = [];
    try {
      const raw = sessionStorage.getItem('partyGameData');
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.players) && data.players.length >= 2) players = data.players;
      }
    } catch {}
    if (players.length < 3) players = ['Játékos 1', 'Játékos 2', 'Játékos 3'];
    setGameState(createKnockoutGame(players));
  }, []);

  const addToQueue = (dart: DartTarget) => {
    if (dartQueue.length >= 3) return;
    setDartQueue([...dartQueue, dart]);
  };

  const handleUndo = () => {
    if (dartQueue.length > 0) setDartQueue(dartQueue.slice(0, -1));
  };

  const handleSubmit = () => {
    if (!gameState || gameState.winner || isProcessing || dartQueue.length === 0) return;
    setIsProcessing(true);

    const prevEliminated = gameState.players.filter((p) => p.isEliminated).map((p) => p.id);
    let currentState = gameState;
    for (const dart of dartQueue) {
      const result = processKnockoutDart(currentState, dart);
      currentState = result.state;
    }

    const finalState = endKnockoutTurn(currentState);
    const newEliminated = finalState.players
      .filter((p) => p.isEliminated && !prevEliminated.includes(p.id))
      .map((p) => p.name);

    if (newEliminated.length > 0) {
      setEliminatedThisRound(newEliminated);
      if (soundEnabled) voiceCaller.speak('Kiesett!');
      setTimeout(() => setEliminatedThisRound([]), 3000);
    }

    setGameState(finalState);
    setDartQueue([]);

    if (finalState.winner && soundEnabled) {
      const winner = finalState.players.find((p) => p.id === finalState.winner);
      voiceCaller.callGameShot(winner?.name);
    }
    setIsProcessing(false);
  };

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const activePlayers = gameState.players.filter((p) => !p.isEliminated);

  return (
    <div className="space-y-4 animate-fade-in">
      {eliminatedThisRound.length > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-error-500 text-white px-6 py-3 rounded-xl shadow-xl animate-bounce flex items-center gap-2">
          <Skull className="w-5 h-5" />
          <span className="font-bold">{eliminatedThisRound.join(', ')} kiesett!</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/game')} leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Vissza
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-dark-500 dark:text-dark-400">Knockout — {gameState.currentRound}. kör</span>
          <Button variant="ghost" size="sm" onClick={() => setSoundEnabled(!soundEnabled)}>
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {gameState.winner && (
        <Card className="bg-success-50 dark:bg-success-900/20 border-success-500">
          <div className="text-center py-4">
            <h2 className="text-2xl font-bold text-success-600">
              {gameState.players.find((p) => p.id === gameState.winner)?.name} nyert!
            </h2>
            <Button className="mt-4" onClick={() => navigate('/game')}>Új játék</Button>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="p-4 border-b border-dark-100 dark:border-dark-700 flex items-center justify-between">
              <h3 className="font-semibold text-dark-900 dark:text-white">{gameState.currentRound}. kör — {activePlayers.length} játékos aktív</h3>
              <span className="text-xs text-dark-500 dark:text-dark-400">
                {gameState.eliminationMode === 'lowest' ? 'Legalacsonyabb kiesik' : 'Átlag alatti kiesik'}
              </span>
            </div>
            <div className="divide-y divide-dark-100 dark:divide-dark-700">
              {gameState.players.map((player, idx) => (
                <div key={player.id} className={`flex items-center justify-between px-4 py-3 ${
                  player.isEliminated ? 'opacity-40' :
                  idx === gameState.currentPlayerIndex ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                }`}>
                  <div className="flex items-center gap-3">
                    {idx === gameState.currentPlayerIndex && !player.isEliminated && (
                      <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                    )}
                    {player.isEliminated && <Skull className="w-4 h-4 text-error-400" />}
                    <div>
                      <p className="font-medium text-dark-900 dark:text-white">{player.name}</p>
                      {player.isEliminated && (
                        <p className="text-xs text-error-500">{player.eliminatedRound}. körben kiesett</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary-600">{player.score}</p>
                    {player.roundScores.length > 0 && (
                      <p className="text-xs text-dark-500">
                        E kör: {player.roundScores[gameState.currentRound - 1] ?? '—'}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark-500 dark:text-dark-400">Aktuális játékos</p>
                <h3 className="text-xl font-bold text-dark-900 dark:text-white">{currentPlayer.name}</h3>
              </div>
              <div className="text-right">
                <p className="text-sm text-dark-500">E kör pontszáma</p>
                <p className="text-2xl font-bold text-dark-900 dark:text-white">{gameState.turnScore}</p>
              </div>
            </div>
          </Card>
        </div>

        <div>
          <DartScoreInput
            onThrow={addToQueue}
            onUndo={handleUndo}
            onSubmit={handleSubmit}
            currentDarts={[]}
            queuedDarts={dartQueue}
            thrownScore={0}
            queuedScore={dartQueue.reduce((sum, dart) => sum + getScore(dart), 0)}
            isProcessing={isProcessing}
            canSubmit={dartQueue.length > 0}
            disabled={!!gameState.winner}
            autoStart={!gameState.winner}
          />
        </div>
      </div>
    </div>
  );
}
