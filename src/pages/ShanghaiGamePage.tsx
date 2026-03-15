import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Volume2, VolumeX, Trophy, Zap } from 'lucide-react';
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
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    for (const dart of dartQueue) {
      const result = processShanghaiDart(currentState, dart);
      currentState = result.state;
      if (soundEnabled && result.hitTarget) voiceCaller.callScore(result.scoreAdded);
    }

    const finalState = endShanghaiTurn(currentState);
    setGameState(finalState);
    setDartQueue([]);

    if (finalState.shanghaiWinner) {
      setShanghaiFlash(true);
      if (soundEnabled) voiceCaller.speak('Shanghai!');
      if (flashRef.current) clearTimeout(flashRef.current);
      flashRef.current = setTimeout(() => setShanghaiFlash(false), 3000);
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
  const roundsLeft = gameState.maxRounds - gameState.currentRound;
  const maxScore = Math.max(...gameState.players.map(p => p.score), 1);

  const getShanghaiStatus = () => {
    const has = [];
    const needs = [];
    if (gameState.turnHasSingle) has.push('S'); else needs.push(`S${targetNumber}`);
    if (gameState.turnHasDouble) has.push('D'); else needs.push(`D${targetNumber}`);
    if (gameState.turnHasTriple) has.push('T'); else needs.push(`T${targetNumber}`);
    return { has, needs };
  };

  const { has, needs } = getShanghaiStatus();

  return (
    <div className="space-y-4 animate-fade-in pb-20 md:pb-4">
      {shanghaiFlash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-warning-500 text-white text-5xl font-black px-12 py-8 rounded-3xl shadow-2xl flex items-center gap-4 animate-bounce">
            <Zap className="w-12 h-12" />
            SHANGHAI!
            <Zap className="w-12 h-12" />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/party-games')} leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Vissza
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-dark-600 dark:text-dark-300">Shanghai</span>
          <span className="text-xs text-dark-400">{gameState.currentRound}/{gameState.maxRounds}</span>
          {roundsLeft <= 3 && roundsLeft > 0 && (
            <span className="text-xs bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400 px-2 py-0.5 rounded-full font-medium">
              {roundsLeft} kör maradt!
            </span>
          )}
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700">
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {gameState.winner && (
        <Card className={`${gameState.shanghaiWinner ? 'bg-warning-50 dark:bg-warning-900/20 border-warning-300 dark:border-warning-700' : 'bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800'}`}>
          <div className="text-center py-6">
            {gameState.shanghaiWinner ? (
              <Zap className="w-14 h-14 text-warning-500 mx-auto mb-3" />
            ) : (
              <Trophy className="w-12 h-12 text-success-500 mx-auto mb-3" />
            )}
            {gameState.shanghaiWinner && (
              <p className="text-warning-600 dark:text-warning-400 font-black text-lg mb-1">AZONNALI SHANGHAI GYŐZELEM!</p>
            )}
            <h2 className="text-2xl font-bold text-success-700 dark:text-success-400">
              {gameState.players.find((p) => p.id === gameState.winner)?.name} nyert!
            </h2>
            <p className="text-sm mt-1 text-dark-500">
              {gameState.players.sort((a, b) => b.score - a.score).map(p => `${p.name}: ${p.score}`).join(' · ')}
            </p>
            <div className="flex gap-3 mt-4 justify-center">
              <Button onClick={() => navigate('/party-games')}>Új játék</Button>
              <Button variant="outline" onClick={() => navigate('/game')}>Főmenü</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Card className="col-span-1 p-4 text-center">
          <p className="text-xs text-dark-400 dark:text-dark-500 uppercase tracking-wide mb-1">Cél szám</p>
          <p className="text-5xl font-black text-primary-600 dark:text-primary-400 leading-none">{targetNumber}</p>
          <div className="mt-2 flex gap-1 justify-center">
            {(['S', 'D', 'T'] as const).map(type => {
              const hit = type === 'S' ? gameState.turnHasSingle : type === 'D' ? gameState.turnHasDouble : gameState.turnHasTriple;
              return (
                <span key={type} className={`w-8 h-8 rounded-lg text-xs font-black flex items-center justify-center transition-colors ${
                  hit
                    ? 'bg-success-500 text-white'
                    : 'bg-dark-100 dark:bg-dark-700 text-dark-400 dark:text-dark-500'
                }`}>{type}</span>
              );
            })}
          </div>
        </Card>

        <Card className="col-span-2 p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-xs text-dark-400 dark:text-dark-500 uppercase tracking-wide">Shanghai státusz</p>
              {has.length > 0 && (
                <p className="text-sm font-semibold text-success-600 dark:text-success-400 mt-0.5">
                  Megvan: {has.map(h => `${h}${targetNumber}`).join(' ')}
                </p>
              )}
              {needs.length > 0 && dartQueue.length === 0 && (
                <p className="text-sm text-dark-600 dark:text-dark-300 mt-0.5">
                  Kell még: <span className="font-bold">{needs.join(' ')}</span>
                </p>
              )}
              {needs.length === 0 && (
                <p className="text-sm font-black text-warning-600 dark:text-warning-400 animate-pulse">SHANGHAI LEHETSÉGES!</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-dark-400">Maradt</p>
              <p className="text-2xl font-black text-dark-900 dark:text-white">{roundsLeft}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {Array.from({ length: gameState.maxRounds }, (_, i) => i + 1).map(n => (
              <span key={n} className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center transition-colors ${
                n < gameState.currentRound ? 'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400' :
                n === gameState.currentRound ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ring-1 ring-primary-400' :
                'bg-dark-100 dark:bg-dark-700 text-dark-400 dark:text-dark-500'
              }`}>{n}</span>
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
                    <div key={player.id} className={`px-4 py-3 ${isCurrent ? 'bg-primary-50/80 dark:bg-primary-900/15' : ''}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`text-sm font-black w-5 text-center tabular-nums ${rank === 0 ? 'text-warning-500' : 'text-dark-400'}`}>{rank + 1}.</span>
                          {isCurrent && <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse shrink-0" />}
                          <span className="font-semibold text-dark-900 dark:text-white truncate text-sm">{player.name}</span>
                          {lastRound !== undefined && lastRound > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400 font-medium shrink-0">
                              +{lastRound}
                            </span>
                          )}
                        </div>
                        <span className={`text-xl font-black tabular-nums ml-2 shrink-0 ${rank === 0 ? 'text-warning-500' : 'text-dark-700 dark:text-dark-200'}`}>
                          {player.score}
                        </span>
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
                  <p className="text-xs text-dark-500">E kör</p>
                  <p className="text-xl font-bold text-dark-900 dark:text-white tabular-nums">{gameState.turnScore}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-500">Összpont</p>
                  <p className="text-xl font-bold text-primary-600 dark:text-primary-400 tabular-nums">{currentPlayer.score}</p>
                </div>
              </div>
            </div>
            {needs.length > 0 && (
              <div className="mt-3 pt-3 border-t border-dark-100 dark:border-dark-700 text-xs text-dark-500">
                Shanghai-hoz kell: <span className="font-bold text-dark-700 dark:text-dark-300">{needs.join(' + ')}</span>
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
