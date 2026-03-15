import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Volume2, VolumeX, Skull, Shield, Target } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DartScoreInput } from '../components/game/DartScoreInput';
import { getScore } from '../lib/dartsEngine';
import {
  createKillerGame,
  processKillerDart,
  endKillerTurn,
  type KillerGameState,
} from '../lib/gameEngines/killerEngine';
import { voiceCaller } from '../lib/voiceCaller';
import type { DartTarget } from '../lib/dartsEngine';

export function KillerGamePage() {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<KillerGameState | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dartQueue, setDartQueue] = useState<DartTarget[]>([]);
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  useEffect(() => {
    let players: string[] = [];
    let killerLives = 3;
    try {
      const raw = sessionStorage.getItem('partyGameData');
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.players) && data.players.length >= 3) players = data.players;
        if (data.options?.killerLives) killerLives = data.options.killerLives;
      }
    } catch {}
    if (players.length < 3) players = ['Játékos 1', 'Játékos 2', 'Játékos 3'];
    setGameState(createKillerGame(players, { lives: killerLives }));
  }, []);

  const addToQueue = (dart: DartTarget) => {
    if (dartQueue.length >= 3) return;
    setDartQueue([...dartQueue, dart]);
  };

  const handleUndo = () => {
    if (dartQueue.length > 0) setDartQueue(dartQueue.slice(0, -1));
  };

  const showEvent = (msg: string) => {
    setLastEvent(msg);
    setTimeout(() => setLastEvent(null), 2500);
  };

  const handleSubmit = () => {
    if (!gameState || gameState.winner || isProcessing || dartQueue.length === 0) return;
    setIsProcessing(true);

    let currentState = gameState;
    for (const dart of dartQueue) {
      const result = processKillerDart(currentState, dart);
      currentState = result.state;
      if (result.assigned !== undefined && soundEnabled) {
        voiceCaller.speak(`D${result.assigned} hozzárendelve`);
        showEvent(`D${result.assigned} hozzárendelve`);
      }
      if (result.becameKiller) {
        showEvent('GYILKOS LETTÉL!');
        if (soundEnabled) voiceCaller.speak('Gyilkos!');
      }
      if (result.killedPlayer) {
        const killed = currentState.players.find((p) => p.id === result.killedPlayer);
        if (killed?.isEliminated) {
          showEvent(`${killed.name} kiesett!`);
          if (soundEnabled) voiceCaller.speak('Kiesett!');
        }
      }
    }

    const finalState = endKillerTurn(currentState);
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

  return (
    <div className="space-y-4 animate-fade-in">
      {lastEvent && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-dark-900 text-white px-6 py-3 rounded-xl shadow-xl font-bold text-lg animate-fade-in">
          {lastEvent}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/game')} leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Vissza
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-dark-500 dark:text-dark-400">
            Killer — {gameState.phase === 'assignment' ? 'Kiosztás' : `${gameState.round}. kör`}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSoundEnabled(!soundEnabled)}>
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {gameState.phase === 'assignment' && (
        <Card className="p-4 bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
          <div className="flex items-start gap-3">
            <Target className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-primary-700 dark:text-primary-300">Kiosztás fázis</p>
              <p className="text-sm text-primary-600 dark:text-primary-400">
                Minden játékos dobjon egy doublét a saját szám megszerzéséhez. Ha már foglalt, próbáld újra!
              </p>
            </div>
          </div>
        </Card>
      )}

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
        <div className="lg:col-span-2">
          <Card>
            <div className="p-4 border-b border-dark-100 dark:border-dark-700">
              <h3 className="font-semibold text-dark-900 dark:text-white">Játékosok</h3>
            </div>
            <div className="divide-y divide-dark-100 dark:divide-dark-700">
              {gameState.players.map((player, idx) => (
                <div key={player.id} className={`flex items-center justify-between px-4 py-3 ${
                  player.isEliminated ? 'opacity-40' :
                  idx === gameState.currentPlayerIndex ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                }`}>
                  <div className="flex items-center gap-3">
                    {!player.isEliminated && idx === gameState.currentPlayerIndex && (
                      <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                    )}
                    {player.isEliminated && <Skull className="w-4 h-4 text-error-400" />}
                    {player.isKiller && !player.isEliminated && (
                      <div className="w-5 h-5 rounded-full bg-error-500 flex items-center justify-center">
                        <Target className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-dark-900 dark:text-white">{player.name}</p>
                      <p className="text-xs text-dark-500">
                        {player.assignedDouble !== null ? `D${player.assignedDouble}` : 'Még nincs szám'}
                        {player.isKiller ? ' · GYILKOS' : ''}
                        {player.isEliminated ? ' · Kiesett' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: gameState.initialLives }, (_, i) => (
                      <div key={i} className={`w-4 h-4 rounded-full ${
                        i < player.lives ? 'bg-error-500' : 'bg-dark-200 dark:bg-dark-600'
                      }`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="mt-4 p-4">
            <div className="flex items-center gap-3">
              {currentPlayer.isKiller ? (
                <div className="w-10 h-10 rounded-lg bg-error-500/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-error-500" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary-500" />
                </div>
              )}
              <div>
                <p className="text-sm text-dark-500 dark:text-dark-400">Aktuális játékos</p>
                <h3 className="text-xl font-bold text-dark-900 dark:text-white">{currentPlayer.name}</h3>
                <p className="text-xs text-dark-500">
                  {gameState.phase === 'assignment'
                    ? 'Dobj doublét a saját számért'
                    : currentPlayer.isKiller
                    ? 'Te vagy a gyilkos — támadd az ellenfél doubleját!'
                    : `Találd el D${currentPlayer.assignedDouble}-t gyilkos lételhez`}
                </p>
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
