import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Volume2, VolumeX, Trophy, AlertTriangle, Check } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DartScoreInput } from '../components/game/DartScoreInput';
import { getScore } from '../lib/dartsEngine';
import {
  createHalveItGame,
  processHalveItDart,
  endHalveItTurn,
  getHalveItTargetDescription,
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
  const [halvedAlert, setHalvedAlert] = useState<{ player: string; from: number; to: number } | null>(null);
  const [hitAlert, setHitAlert] = useState<{ player: string; score: number } | null>(null);
  const halvedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let players: string[] = [];
    try {
      const raw = sessionStorage.getItem('partyGameData');
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.players) && data.players.length >= 2) players = data.players;
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

    const playerName = gameState.players[gameState.currentPlayerIndex].name;
    const scoreBefore = gameState.players[gameState.currentPlayerIndex].score;
    let currentState = gameState;

    for (const dart of dartQueue) {
      const result = processHalveItDart(currentState, dart);
      currentState = result.state;
      if (soundEnabled && result.hitTarget) voiceCaller.speak('Hit!');
    }

    const finalState = endHalveItTurn(currentState);
    const playerAfter = finalState.players[gameState.currentPlayerIndex];

    if (currentState.turnHitTarget) {
      const gained = currentState.turnScore;
      if (gained > 0) {
        setHitAlert({ player: playerName, score: gained });
        if (soundEnabled) voiceCaller.callScore(gained);
        if (halvedTimerRef.current) clearTimeout(halvedTimerRef.current);
        halvedTimerRef.current = setTimeout(() => setHitAlert(null), 2500);
      }
    } else {
      const to = playerAfter.score;
      setHalvedAlert({ player: playerName, from: scoreBefore, to });
      if (soundEnabled) voiceCaller.speak('Felez!');
      if (halvedTimerRef.current) clearTimeout(halvedTimerRef.current);
      halvedTimerRef.current = setTimeout(() => setHalvedAlert(null), 3000);
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

  const currentTarget = gameState.targets[gameState.currentTargetIndex];
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const maxScore = Math.max(...gameState.players.map(p => p.score), 1);

  return (
    <div className="space-y-4 animate-fade-in pb-20 md:pb-4">
      {halvedAlert && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-error-600 text-white px-5 py-3 rounded-xl shadow-2xl animate-fade-in flex items-center gap-3 pointer-events-none">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-bold">{halvedAlert.player} — FELEZ!</p>
            <p className="text-sm opacity-90">{halvedAlert.from} → {halvedAlert.to} pont</p>
          </div>
        </div>
      )}
      {hitAlert && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-success-600 text-white px-5 py-3 rounded-xl shadow-2xl animate-fade-in flex items-center gap-3 pointer-events-none">
          <Check className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-bold">{hitAlert.player} — ELTALÁLVA!</p>
            <p className="text-sm opacity-90">+{hitAlert.score} pont</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/party-games')} leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Vissza
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-dark-600 dark:text-dark-300">Halve-It</span>
          <span className="text-xs text-dark-400">{gameState.round}. kör / {gameState.targets.length}</span>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700">
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {gameState.winner && (
        <Card className="bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800">
          <div className="text-center py-6">
            <Trophy className="w-12 h-12 text-success-500 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-success-700 dark:text-success-400">
              {gameState.players.find((p) => p.id === gameState.winner)?.name} nyert!
            </h2>
            <p className="text-sm text-success-600 dark:text-success-500 mt-1">
              {gameState.players.sort((a, b) => b.score - a.score).map(p => `${p.name}: ${p.score}`).join(' · ')}
            </p>
            <div className="flex gap-3 mt-4 justify-center">
              <Button onClick={() => navigate('/party-games')}>Új játék</Button>
              <Button variant="outline" onClick={() => navigate('/game')}>Főmenü</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3">
        <Card className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-dark-400 dark:text-dark-500 uppercase tracking-wide mb-1">Jelenlegi cél</p>
              <h2 className="text-2xl font-black text-primary-600 dark:text-primary-400">{currentTarget?.label}</h2>
              <p className="text-sm text-dark-500 dark:text-dark-400 mt-0.5">
                {currentTarget ? getHalveItTargetDescription(currentTarget) : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-dark-400 uppercase tracking-wide">Kör</p>
              <p className="text-3xl font-black text-dark-900 dark:text-white tabular-nums">{gameState.round}</p>
              <p className="text-xs text-dark-400">/ {gameState.targets.length}</p>
            </div>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {gameState.targets.map((t, i) => (
              <span key={i} className={`flex-1 min-w-[2rem] py-1 rounded-lg text-xs font-bold text-center transition-all ${
                i < gameState.currentTargetIndex
                  ? 'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400'
                  : i === gameState.currentTargetIndex
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ring-1 ring-primary-400 dark:ring-primary-600 scale-105'
                  : 'bg-dark-100 dark:bg-dark-700 text-dark-400 dark:text-dark-500'
              }`}>{t.label}</span>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden">
            <div className="divide-y divide-dark-100 dark:divide-dark-800">
              {gameState.players
                .slice()
                .sort((a, b) => b.score - a.score)
                .map((player, rank) => {
                  const originalIdx = gameState.players.findIndex(p => p.id === player.id);
                  const isCurrent = originalIdx === gameState.currentPlayerIndex;
                  const lastRound = player.roundScores[player.roundScores.length - 1];
                  const barWidth = maxScore > 0 ? (player.score / maxScore) * 100 : 0;

                  return (
                    <div key={player.id} className={`px-4 py-3 transition-colors ${
                      isCurrent ? 'bg-primary-50/80 dark:bg-primary-900/15' : ''
                    }`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`text-sm font-black w-5 text-center tabular-nums ${
                            rank === 0 ? 'text-warning-500' : 'text-dark-400'
                          }`}>{rank + 1}.</span>
                          {isCurrent && <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse shrink-0" />}
                          <span className="font-semibold text-dark-900 dark:text-white truncate text-sm">{player.name}</span>
                          {lastRound !== undefined && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                              lastRound > 0
                                ? 'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400'
                                : 'bg-error-100 dark:bg-error-900/30 text-error-500 dark:text-error-400'
                            }`}>
                              {lastRound > 0 ? `+${lastRound}` : 'felez'}
                            </span>
                          )}
                        </div>
                        <span className={`text-xl font-black tabular-nums ml-2 shrink-0 ${
                          rank === 0 ? 'text-warning-500' : 'text-dark-700 dark:text-dark-200'
                        }`}>{player.score}</span>
                      </div>
                      <div className="h-1.5 bg-dark-100 dark:bg-dark-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${rank === 0 ? 'bg-warning-500' : 'bg-primary-400 dark:bg-primary-500'}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                  <span className="text-primary-700 dark:text-primary-400 font-bold text-sm">
                    {currentPlayer.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-dark-500 dark:text-dark-400">Következő dobó</p>
                  <h3 className="font-bold text-dark-900 dark:text-white">{currentPlayer.name}</h3>
                </div>
              </div>
              <div className="flex gap-4 text-right">
                <div>
                  <p className="text-xs text-dark-500">Kör pontjai</p>
                  <p className="text-xl font-bold text-dark-900 dark:text-white tabular-nums">{gameState.turnScore}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-500">Összpont</p>
                  <p className="text-xl font-bold text-primary-600 dark:text-primary-400 tabular-nums">{currentPlayer.score}</p>
                </div>
              </div>
            </div>
            {gameState.turnHitTarget && (
              <div className="mt-3 flex items-center gap-2 text-success-600 dark:text-success-400 text-sm">
                <Check className="w-4 h-4" />
                <span className="font-medium">Eltalálva! Pontok összegyűlnek...</span>
              </div>
            )}
            {!gameState.turnHitTarget && dartQueue.length > 0 && gameState.turnDarts.length === 0 && (
              <div className="mt-3 text-xs text-dark-500 dark:text-dark-400">
                Cél: <span className="font-semibold text-dark-700 dark:text-dark-200">{currentTarget?.label}</span> — {currentTarget ? getHalveItTargetDescription(currentTarget) : ''}
              </div>
            )}
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
