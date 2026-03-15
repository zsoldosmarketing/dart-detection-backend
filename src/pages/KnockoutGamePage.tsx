import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Volume2, VolumeX, Trophy, Skull, TrendingDown, AlertTriangle } from 'lucide-react';
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

interface RoundSummary {
  round: number;
  eliminated: string[];
  scores: { name: string; score: number; isEliminated: boolean }[];
  average: number;
}

export function KnockoutGamePage() {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<KnockoutGameState | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dartQueue, setDartQueue] = useState<DartTarget[]>([]);
  const [eliminationAlert, setEliminationAlert] = useState<string[] | null>(null);
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let players: string[] = [];
    let knockoutMode: 'lowest' | 'below_average' = 'lowest';
    try {
      const raw = sessionStorage.getItem('partyGameData');
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.players) && data.players.length >= 3) players = data.players;
        if (data.options?.knockoutMode) knockoutMode = data.options.knockoutMode;
      }
    } catch {}
    if (players.length < 3) players = ['Játékos 1', 'Játékos 2', 'Játékos 3'];
    setGameState(createKnockoutGame(players, { eliminationMode: knockoutMode }));
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

    const prevEliminated = gameState.players.filter(p => p.isEliminated).map(p => p.id);
    const prevRound = gameState.currentRound;
    let currentState = gameState;

    for (const dart of dartQueue) {
      const result = processKnockoutDart(currentState, dart);
      currentState = result.state;
    }

    const finalState = endKnockoutTurn(currentState);
    const newEliminated = finalState.players
      .filter(p => p.isEliminated && !prevEliminated.includes(p.id))
      .map(p => p.name);

    if (newEliminated.length > 0) {
      setEliminationAlert(newEliminated);
      if (soundEnabled) voiceCaller.speak('Kiesett!');
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
      alertTimerRef.current = setTimeout(() => setEliminationAlert(null), 3000);

      const activePlayers = finalState.players.filter(p => !prevEliminated.includes(p.id));
      const scores = activePlayers.map(p => ({
        name: p.name,
        score: p.roundScores[prevRound - 1] || 0,
        isEliminated: newEliminated.includes(p.name),
      }));
      const avg = scores.length > 0 ? Math.round(scores.reduce((s, p) => s + p.score, 0) / scores.length) : 0;
      setRoundSummary({ round: prevRound, eliminated: newEliminated, scores, average: avg });
      setShowSummary(true);
    }

    setGameState(finalState);
    setDartQueue([]);

    if (finalState.winner && soundEnabled) {
      const winner = finalState.players.find(p => p.id === finalState.winner);
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
  const activePlayers = gameState.players.filter(p => !p.isEliminated);
  const currentRoundScores = activePlayers
    .filter(p => p.roundScores.length >= gameState.currentRound)
    .map(p => p.roundScores[gameState.currentRound - 1]);
  const roundAvg = currentRoundScores.length > 0
    ? Math.round(currentRoundScores.reduce((a, b) => a + b, 0) / currentRoundScores.length)
    : null;

  return (
    <div className="space-y-4 animate-fade-in pb-20 md:pb-4">
      {eliminationAlert && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-error-600 text-white px-5 py-3 rounded-xl shadow-2xl animate-fade-in flex items-center gap-3 pointer-events-none">
          <Skull className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-bold">{eliminationAlert.join(', ')} kiesett!</p>
            <p className="text-sm opacity-90">Jobban kellett volna dobni...</p>
          </div>
        </div>
      )}

      {showSummary && roundSummary && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowSummary(false)}>
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-5 h-5 text-error-500" />
              <h3 className="font-bold text-dark-900 dark:text-white">{roundSummary.round}. kör eredménye</h3>
            </div>
            <div className="space-y-2 mb-4">
              {roundSummary.scores.sort((a, b) => b.score - a.score).map((p, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                  p.isEliminated ? 'bg-error-50 dark:bg-error-900/20' : 'bg-dark-50 dark:bg-dark-700'
                }`}>
                  <div className="flex items-center gap-2">
                    {p.isEliminated && <Skull className="w-3.5 h-3.5 text-error-500" />}
                    <span className={`font-medium text-sm ${p.isEliminated ? 'text-error-600 dark:text-error-400' : 'text-dark-900 dark:text-white'}`}>
                      {p.name}
                    </span>
                  </div>
                  <span className={`font-bold tabular-nums text-sm ${p.isEliminated ? 'text-error-500' : 'text-dark-700 dark:text-dark-300'}`}>
                    {p.score}
                  </span>
                </div>
              ))}
            </div>
            {roundSummary.average > 0 && (
              <p className="text-xs text-dark-500 mb-4">Átlag: {roundSummary.average} pont</p>
            )}
            <Button className="w-full" onClick={() => setShowSummary(false)}>
              Tovább
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/party-games')} leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Vissza
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-dark-600 dark:text-dark-300">Knockout</span>
          <span className="text-xs text-dark-400">{gameState.currentRound}. kör</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            gameState.eliminationMode === 'lowest'
              ? 'bg-dark-100 dark:bg-dark-700 text-dark-500 dark:text-dark-400'
              : 'bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400'
          }`}>
            {gameState.eliminationMode === 'lowest' ? 'Legalacsonyabb' : 'Átlag alatt'}
          </span>
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
              {gameState.players.find(p => p.id === gameState.winner)?.name} nyert!
            </h2>
            <p className="text-sm text-dark-500 mt-1">
              {gameState.players
                .filter(p => p.isEliminated)
                .sort((a, b) => (b.eliminatedRound || 0) - (a.eliminatedRound || 0))
                .map(p => `${p.name} (${p.eliminatedRound}. kör)`)
                .join(' · ')}
            </p>
            <div className="flex gap-3 mt-4 justify-center">
              <Button onClick={() => navigate('/party-games')}>Új játék</Button>
              <Button variant="outline" onClick={() => navigate('/game')}>Főmenü</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-dark-100 dark:border-dark-700 flex items-center justify-between">
              <div>
                <span className="font-semibold text-dark-900 dark:text-white text-sm">{gameState.currentRound}. kör</span>
                <span className="text-xs text-dark-400 ml-2">{activePlayers.length} aktív játékos</span>
              </div>
              {roundAvg !== null && roundAvg > 0 && (
                <span className="text-xs text-dark-500">Átlag: <span className="font-semibold text-dark-700 dark:text-dark-200">{roundAvg}</span></span>
              )}
            </div>
            <div className="divide-y divide-dark-100 dark:divide-dark-800">
              {gameState.players.map((player, idx) => {
                const roundScore = player.roundScores[gameState.currentRound - 1];
                const hasPlayedThisRound = roundScore !== undefined;
                const isBelowAvg = roundAvg !== null && hasPlayedThisRound && roundScore < roundAvg && !player.isEliminated;
                const isLowest = !player.isEliminated && hasPlayedThisRound && currentRoundScores.length > 0 &&
                  roundScore === Math.min(...currentRoundScores) && currentRoundScores.filter(s => s === roundScore).length < activePlayers.length;

                return (
                  <div key={player.id} className={`flex items-center justify-between px-4 py-3 transition-colors ${
                    player.isEliminated ? 'opacity-40' :
                    idx === gameState.currentPlayerIndex ? 'bg-primary-50/80 dark:bg-primary-900/15' : ''
                  }`}>
                    <div className="flex items-center gap-3 min-w-0">
                      {player.isEliminated
                        ? <Skull className="w-4 h-4 text-error-400 shrink-0" />
                        : idx === gameState.currentPlayerIndex
                          ? <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse shrink-0" />
                          : <div className="w-2 h-2 shrink-0" />
                      }
                      <div className="min-w-0">
                        <p className="font-medium text-dark-900 dark:text-white text-sm truncate">{player.name}</p>
                        {player.isEliminated && (
                          <p className="text-xs text-error-500">{player.eliminatedRound}. körben kiesett</p>
                        )}
                      </div>
                      {(isLowest || isBelowAvg) && !player.isEliminated && hasPlayedThisRound && (
                        <AlertTriangle className="w-3.5 h-3.5 text-warning-500 shrink-0" />
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      {hasPlayedThisRound && !player.isEliminated && (
                        <p className={`text-lg font-bold tabular-nums ${
                          isLowest || isBelowAvg ? 'text-error-500' : 'text-dark-700 dark:text-dark-200'
                        }`}>{roundScore}</p>
                      )}
                      <p className="text-xs text-dark-400 tabular-nums">∑ {player.score}</p>
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
              <div className="text-right">
                <p className="text-xs text-dark-500">E kör pontszáma</p>
                <p className="text-2xl font-black text-dark-900 dark:text-white tabular-nums">{gameState.turnScore}</p>
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
