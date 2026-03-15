import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Volume2, VolumeX, Zap } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DartScoreInput } from '../components/game/DartScoreInput';
import { getScore } from '../lib/dartsEngine';
import {
  createShanghaiGame,
  processShanghaiDart,
  endShanghaiTurn,
  type ShanghaiGameState,
} from '../lib/gameEngines/shanghaiEngine';
import { voiceCaller } from '../lib/voiceCaller';
import type { DartTarget } from '../lib/dartsEngine';

export function ShanghaiGamePage() {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<ShanghaiGameState | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dartQueue, setDartQueue] = useState<DartTarget[]>([]);
  const [shanghaiFlash, setShanghaiFlash] = useState(false);

  useEffect(() => {
    let players: string[] = [];
    let maxRounds = 20;
    try {
      const raw = sessionStorage.getItem('partyGameData');
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.players) && data.players.length >= 2) players = data.players;
        if (data.options?.shanghaiRounds) maxRounds = data.options.shanghaiRounds;
      }
    } catch {}
    if (players.length < 2) players = ['Játékos 1', 'Játékos 2'];
    setGameState(createShanghaiGame(players, { maxRounds }));
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
    let shanghaiAchieved = false;

    for (const dart of dartQueue) {
      const result = processShanghaiDart(currentState, dart);
      currentState = result.state;
      if (result.isShanghai) shanghaiAchieved = true;
    }

    const finalState = endShanghaiTurn(currentState);
    setGameState(finalState);
    setDartQueue([]);

    if (shanghaiAchieved || finalState.shanghaiWinner) {
      setShanghaiFlash(true);
      if (soundEnabled) voiceCaller.speak('Shanghai!');
      setTimeout(() => setShanghaiFlash(false), 2000);
    } else if (finalState.winner && soundEnabled) {
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
  const targetNumber = gameState.currentRound;

  return (
    <div className="space-y-4 animate-fade-in">
      {shanghaiFlash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-warning-500 text-white text-5xl font-black px-12 py-6 rounded-2xl shadow-2xl animate-bounce flex items-center gap-4">
            <Zap className="w-12 h-12" /> SHANGHAI! <Zap className="w-12 h-12" />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/game')} leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Vissza
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-dark-500 dark:text-dark-400">Shanghai</span>
          <Button variant="ghost" size="sm" onClick={() => setSoundEnabled(!soundEnabled)}>
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {gameState.winner && (
        <Card className={`${gameState.shanghaiWinner ? 'bg-warning-50 dark:bg-warning-900/20 border-warning-500' : 'bg-success-50 dark:bg-success-900/20 border-success-500'}`}>
          <div className="text-center py-4">
            {gameState.shanghaiWinner && (
              <p className="text-warning-600 font-bold text-sm mb-1">SHANGHAI GYŐZELEM!</p>
            )}
            <h2 className="text-2xl font-bold text-success-600">
              {gameState.players.find((p) => p.id === gameState.winner)?.name} nyert!
            </h2>
            <Button className="mt-4" onClick={() => navigate('/game')}>Új játék</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Card className="col-span-1 p-4 text-center bg-primary-50 dark:bg-primary-900/20">
          <p className="text-xs text-dark-500 uppercase tracking-wide mb-1">Cél szám</p>
          <p className="text-4xl font-black text-primary-600">{targetNumber}</p>
          <p className="text-xs text-dark-500 mt-1">S{targetNumber} · D{targetNumber} · T{targetNumber}</p>
        </Card>
        <Card className="col-span-2 p-4">
          <p className="text-xs text-dark-500 uppercase tracking-wide mb-2">Kör haladás</p>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: gameState.maxRounds }, (_, i) => i + 1).map(n => (
              <span key={n} className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${
                n < gameState.currentRound ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' :
                n === gameState.currentRound ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 ring-1 ring-primary-400' :
                'bg-dark-100 text-dark-400 dark:bg-dark-700'
              }`}>{n}</span>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-200 dark:border-dark-700">
                    <th className="py-3 px-4 text-left font-semibold text-dark-600 dark:text-dark-300">Játékos</th>
                    <th className="py-3 px-4 text-right font-bold text-dark-900 dark:text-white">Összpontszám</th>
                    <th className="py-3 px-4 text-right text-xs text-dark-500">Utolsó</th>
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
              <div className="flex gap-4 text-right">
                <div>
                  <p className="text-xs text-dark-500">Single</p>
                  <div className={`w-4 h-4 rounded-full mx-auto mt-1 ${gameState.turnHasSingle ? 'bg-success-500' : 'bg-dark-200 dark:bg-dark-600'}`} />
                </div>
                <div>
                  <p className="text-xs text-dark-500">Double</p>
                  <div className={`w-4 h-4 rounded-full mx-auto mt-1 ${gameState.turnHasDouble ? 'bg-success-500' : 'bg-dark-200 dark:bg-dark-600'}`} />
                </div>
                <div>
                  <p className="text-xs text-dark-500">Triple</p>
                  <div className={`w-4 h-4 rounded-full mx-auto mt-1 ${gameState.turnHasTriple ? 'bg-success-500' : 'bg-dark-200 dark:bg-dark-600'}`} />
                </div>
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
