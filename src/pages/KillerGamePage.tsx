import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Volume2, VolumeX, Trophy, Skull, Target, Swords, Shield, Heart } from 'lucide-react';
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

interface EventAlert {
  type: 'kill' | 'damage' | 'killer' | 'assign' | 'selfhit';
  message: string;
  sub?: string;
}

export function KillerGamePage() {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<KillerGameState | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dartQueue, setDartQueue] = useState<DartTarget[]>([]);
  const [eventAlert, setEventAlert] = useState<EventAlert | null>(null);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const showAlert = (alert: EventAlert, duration = 3000) => {
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    setEventAlert(alert);
    alertTimerRef.current = setTimeout(() => setEventAlert(null), duration);
  };

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
    let lastAlert: EventAlert | null = null;

    for (const dart of dartQueue) {
      const prevLives: Record<string, number> = {};
      currentState.players.forEach(p => { prevLives[p.id] = p.lives; });

      const result = processKillerDart(currentState, dart);
      currentState = result.state;

      if (result.assigned !== undefined) {
        lastAlert = {
          type: 'assign',
          message: `D${result.assigned} megszerzve!`,
          sub: `${currentState.players[currentState.currentPlayerIndex]?.name} saját száma`,
        };
        if (soundEnabled) voiceCaller.speak(`D${result.assigned} hozzárendelve`);
      }

      if (result.becameKiller) {
        lastAlert = {
          type: 'killer',
          message: 'GYILKOS LESZEL!',
          sub: currentState.players[currentState.currentPlayerIndex]?.name,
        };
        if (soundEnabled) voiceCaller.speak('Gyilkos!');
      }

      if (result.selfHit) {
        const currentP = currentState.players[currentState.currentPlayerIndex];
        lastAlert = {
          type: 'selfhit',
          message: `${currentP?.name} saját magát sebezte!`,
          sub: `${currentP?.lives}/${currentState.initialLives} élet maradt`,
        };
        if (soundEnabled) voiceCaller.speak('Önhit!');
      }

      if (result.killedPlayer !== undefined) {
        const killed = currentState.players.find(p => p.id === result.killedPlayer);
        const prevL = prevLives[result.killedPlayer];
        if (killed?.isEliminated) {
          lastAlert = {
            type: 'kill',
            message: `${killed.name} KIESETT!`,
            sub: 'Nincs több élete',
          };
          if (soundEnabled) voiceCaller.speak('Kiesett!');
        } else if (killed) {
          lastAlert = {
            type: 'damage',
            message: `${killed.name} megsebesült!`,
            sub: `${prevL} → ${killed.lives} élet`,
          };
          if (soundEnabled) voiceCaller.speak('Találat!');
        }
      }
    }

    if (lastAlert) showAlert(lastAlert);

    const finalState = endKillerTurn(currentState);
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
  const killers = activePlayers.filter(p => p.isKiller);
  const takenDoubles = gameState.players
    .filter(p => p.assignedDouble !== null)
    .map(p => p.assignedDouble as number);

  const alertColors: Record<EventAlert['type'], string> = {
    kill: 'bg-error-600',
    damage: 'bg-warning-600',
    killer: 'bg-error-700',
    assign: 'bg-primary-600',
    selfhit: 'bg-warning-700',
  };

  const alertIcons: Record<EventAlert['type'], React.ReactNode> = {
    kill: <Skull className="w-5 h-5 shrink-0" />,
    damage: <Heart className="w-5 h-5 shrink-0" />,
    killer: <Swords className="w-5 h-5 shrink-0" />,
    assign: <Target className="w-5 h-5 shrink-0" />,
    selfhit: <Shield className="w-5 h-5 shrink-0" />,
  };

  return (
    <div className="space-y-4 animate-fade-in pb-20 md:pb-4">
      {eventAlert && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 ${alertColors[eventAlert.type]} text-white px-5 py-3 rounded-xl shadow-2xl animate-fade-in flex items-center gap-3 pointer-events-none`}>
          {alertIcons[eventAlert.type]}
          <div>
            <p className="font-bold">{eventAlert.message}</p>
            {eventAlert.sub && <p className="text-sm opacity-90">{eventAlert.sub}</p>}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/party-games')} leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Vissza
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-dark-600 dark:text-dark-300">Killer</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            gameState.phase === 'assignment'
              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
              : 'bg-error-100 dark:bg-error-900/30 text-error-600 dark:text-error-400'
          }`}>
            {gameState.phase === 'assignment' ? 'Kiosztás' : `${gameState.round}. kör`}
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
            <div className="mt-3 space-y-1">
              {gameState.players
                .filter(p => p.isEliminated)
                .map(p => (
                  <p key={p.id} className="text-sm text-dark-500">
                    <Skull className="inline w-3.5 h-3.5 text-error-400 mr-1" />
                    {p.name} — D{p.assignedDouble}
                  </p>
                ))}
            </div>
            <div className="flex gap-3 mt-4 justify-center">
              <Button onClick={() => navigate('/party-games')}>Új játék</Button>
              <Button variant="outline" onClick={() => navigate('/game')}>Főmenü</Button>
            </div>
          </div>
        </Card>
      )}

      {gameState.phase === 'assignment' && (
        <Card className="p-4 bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
          <div className="flex items-start gap-3 mb-3">
            <Target className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-primary-700 dark:text-primary-300 text-sm">Kiosztás fázis</p>
              <p className="text-xs text-primary-600 dark:text-primary-400">
                Mindenki dobjon egy doublét a saját számáért. Ha már foglalt, próbálj másikat!
              </p>
            </div>
          </div>
          {takenDoubles.length > 0 && (
            <div>
              <p className="text-xs text-dark-500 dark:text-dark-400 mb-1.5">Foglalt számok:</p>
              <div className="flex flex-wrap gap-1.5">
                {takenDoubles.sort((a, b) => a - b).map(num => {
                  const owner = gameState.players.find(p => p.assignedDouble === num);
                  return (
                    <span key={num} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-dark-100 dark:bg-dark-700 text-xs font-semibold text-dark-700 dark:text-dark-300">
                      D{num}
                      <span className="text-dark-400 dark:text-dark-500 font-normal">({owner?.name})</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {gameState.phase === 'playing' && killers.length > 0 && (
        <Card className="p-3 bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-800">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-error-500 shrink-0" />
            <div className="flex flex-wrap gap-1.5">
              {killers.map(k => (
                <span key={k.id} className="text-xs font-bold text-error-600 dark:text-error-400">
                  {k.name} (D{k.assignedDouble}) = GYILKOS
                </span>
              ))}
            </div>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-dark-100 dark:border-dark-700">
              <span className="font-semibold text-dark-900 dark:text-white text-sm">
                {activePlayers.length} aktív játékos
              </span>
              <span className="text-xs text-dark-400 ml-2">
                / {gameState.players.length} összesen
              </span>
            </div>
            <div className="divide-y divide-dark-100 dark:divide-dark-800">
              {gameState.players.map((player, idx) => (
                <div key={player.id} className={`flex items-center justify-between px-4 py-3 transition-colors ${
                  player.isEliminated ? 'opacity-40' :
                  idx === gameState.currentPlayerIndex ? 'bg-primary-50/80 dark:bg-primary-900/15' : ''
                }`}>
                  <div className="flex items-center gap-3 min-w-0">
                    {player.isEliminated
                      ? <Skull className="w-4 h-4 text-error-400 shrink-0" />
                      : player.isKiller
                      ? <Swords className="w-4 h-4 text-error-500 shrink-0" />
                      : idx === gameState.currentPlayerIndex
                      ? <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse shrink-0" />
                      : <div className="w-2 h-2 shrink-0" />
                    }
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium text-sm truncate ${
                          player.isEliminated
                            ? 'text-dark-400 dark:text-dark-500'
                            : player.isKiller
                            ? 'text-error-600 dark:text-error-400'
                            : 'text-dark-900 dark:text-white'
                        }`}>{player.name}</p>
                        {player.isKiller && !player.isEliminated && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-error-100 dark:bg-error-900/30 text-error-600 dark:text-error-400 font-bold shrink-0">
                            GYILKOS
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-dark-400">
                        {player.assignedDouble !== null ? `D${player.assignedDouble}` : 'Nincs szám'}
                        {player.isEliminated && ' · Kiesett'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    {Array.from({ length: gameState.initialLives }, (_, i) => (
                      <div key={i} className={`w-3.5 h-3.5 rounded-full transition-colors ${
                        i < player.lives
                          ? player.isKiller ? 'bg-error-500' : 'bg-primary-500'
                          : 'bg-dark-200 dark:bg-dark-600'
                      }`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                currentPlayer.isKiller
                  ? 'bg-error-100 dark:bg-error-900/30'
                  : 'bg-primary-100 dark:bg-primary-900/30'
              }`}>
                {currentPlayer.isKiller
                  ? <Swords className="w-5 h-5 text-error-500" />
                  : <span className="text-primary-700 dark:text-primary-400 font-bold text-sm">
                      {currentPlayer.name.slice(0, 2).toUpperCase()}
                    </span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-dark-500 dark:text-dark-400">Következő dobó</p>
                <h3 className="font-bold text-dark-900 dark:text-white truncate">{currentPlayer.name}</h3>
                <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">
                  {gameState.phase === 'assignment'
                    ? currentPlayer.assignedDouble !== null
                      ? `Már megvan: D${currentPlayer.assignedDouble} — Vár a következő körre`
                      : 'Dobj doublét a saját számért!'
                    : currentPlayer.isKiller
                    ? `Gyilkos — Találd el az ellenfelek doubleját! (${activePlayers.filter(p => !p.isKiller && p.id !== currentPlayer.id).map(p => `D${p.assignedDouble}`).join(', ')})`
                    : currentPlayer.assignedDouble !== null
                    ? `Találd el D${currentPlayer.assignedDouble}-t a gyilkos státuszért!`
                    : 'Dobj doublét a saját számért!'
                  }
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-dark-400 mb-1">Élet</p>
                <div className="flex gap-1 justify-end">
                  {Array.from({ length: gameState.initialLives }, (_, i) => (
                    <div key={i} className={`w-3 h-3 rounded-full ${
                      i < currentPlayer.lives
                        ? currentPlayer.isKiller ? 'bg-error-500' : 'bg-primary-500'
                        : 'bg-dark-200 dark:bg-dark-600'
                    }`} />
                  ))}
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
