import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DartScoreInput } from '../components/game/DartScoreInput';
import { getScore } from '../lib/dartsEngine';
import {
  createHalveItGame,
  processHalveItDart,
  endHalveItTurn,
  type HalveItGameState,
} from '../lib/gameEngines/halveItEngine';
import { voiceCaller } from '../lib/voiceCaller';
import type { DartTarget } from '../lib/dartsEngine';

export function HalveItGamePage() {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<HalveItGameState | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dartQueue, setDartQueue] = useState<DartTarget[]>([]);

  useEffect(() => {
    let players: string[] = [];
    try {
      const raw = sessionStorage.getItem('partyGameData');
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.players) && data.players.length >= 2) {
          players = data.players;
        }
      }
    } catch {}
    if (players.length < 2) players = ['Játékos 1', 'Játékos 2'];
    setGameState(createHalveItGame(players));
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

    let currentState = gameState;
    for (const dart of dartQueue) {
      const result = processHalveItDart(currentState, dart);
      currentState = result.state;
      if (soundEnabled && result.hitTarget) {
        voiceCaller.speak('Hit!');
      }
    }

    const finalState = endHalveItTurn(currentState);
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
  const currentTarget = gameState.targets[gameState.currentTargetIndex];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/game')} leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Vissza
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-dark-500 dark:text-dark-400">Halve-It</span>
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

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-dark-500 dark:text-dark-400 uppercase tracking-wide">Jelenlegi cél</p>
            <p className="text-xl font-bold text-primary-600 dark:text-primary-400">{currentTarget?.label}</p>
            <p className="text-xs text-dark-500 mt-0.5">
              {currentTarget?.type === 'number' ? `Találd el a ${currentTarget.value}-es területet` :
               currentTarget?.type === 'double' ? 'Találd el bármely doublét' :
               currentTarget?.type === 'triple' ? 'Találd el bármely triplét' : 'Találd el a Bullt'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-dark-500 dark:text-dark-400">Kör</p>
            <p className="text-lg font-bold text-dark-900 dark:text-white">{gameState.round} / {gameState.targets.length}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-dark-100 dark:border-dark-700">
          {gameState.targets.map((t, i) => (
            <span key={i} className={`px-2 py-0.5 rounded text-xs font-medium ${
              i < gameState.currentTargetIndex ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' :
              i === gameState.currentTargetIndex ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 ring-1 ring-primary-400' :
              'bg-dark-100 text-dark-500 dark:bg-dark-700'
            }`}>{t.label}</span>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-200 dark:border-dark-700">
                    <th className="py-3 px-4 text-left font-semibold text-dark-600 dark:text-dark-300">Játékos</th>
                    <th className="py-3 px-4 text-right font-bold text-dark-900 dark:text-white">Pontszám</th>
                    <th className="py-3 px-4 text-right text-xs text-dark-500">Utolsó kör</th>
                  </tr>
                </thead>
                <tbody>
                  {gameState.players.map((player, idx) => (
                    <tr key={player.id} className={`border-b border-dark-100 dark:border-dark-800 ${
                      idx === gameState.currentPlayerIndex ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {idx === gameState.currentPlayerIndex && (
                            <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                          )}
                          <span className="font-medium text-dark-900 dark:text-white">{player.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-xl font-bold text-primary-600">{player.score}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-dark-500">
                        {player.roundScores.length > 0 ? player.roundScores[player.roundScores.length - 1] : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="mt-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark-500 dark:text-dark-400">Aktuális játékos</p>
                <h3 className="text-xl font-bold text-dark-900 dark:text-white">{currentPlayer.name}</h3>
              </div>
              <div className="text-right">
                <p className="text-sm text-dark-500 dark:text-dark-400">Kör pontszám</p>
                <p className="text-lg font-semibold text-dark-900 dark:text-white">{gameState.turnScore}</p>
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
