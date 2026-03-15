import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Volume2, VolumeX, Trophy, HelpCircle, X } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DartScoreInput } from '../components/game/DartScoreInput';
import { getScore } from '../lib/dartsEngine';
import {
  createCricketGame,
  processCricketDart,
  endCricketTurn,
  getCricketMarksDisplay,
  type CricketGameState,
} from '../lib/gameEngines/cricketEngine';
import { voiceCaller } from '../lib/voiceCaller';
import type { DartTarget } from '../lib/dartsEngine';

const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15, 25];

function MarksLegend() {
  return (
    <div className="flex items-center gap-3 text-xs text-dark-500 dark:text-dark-400">
      <span className="flex items-center gap-1"><span className="font-mono font-bold text-dark-400">/</span> = 1 mark</span>
      <span className="flex items-center gap-1"><span className="font-mono font-bold text-dark-600 dark:text-dark-300">X</span> = 2 mark</span>
      <span className="flex items-center gap-1"><span className="font-mono font-bold text-success-500">O</span> = ZÁRVA</span>
    </div>
  );
}

export function CricketGamePage() {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<CricketGameState | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dartQueue, setDartQueue] = useState<DartTarget[]>([]);
  const [showLegend, setShowLegend] = useState(false);
  const [lastTurnResult, setLastTurnResult] = useState<{ player: string; marks: Record<number, number>; points: number } | null>(null);
  const [showTurnResult, setShowTurnResult] = useState(false);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let players: string[] = [];
    let options = { cutthroat: false, pointsMode: true };
    try {
      const raw = sessionStorage.getItem('partyGameData');
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.players) && data.players.length >= 2) players = data.players;
        if (data.options?.cricketCutthroat !== undefined) options.cutthroat = data.options.cricketCutthroat;
      }
    } catch {}
    if (players.length < 2) players = ['Játékos 1', 'Játékos 2'];
    setGameState(createCricketGame(players, options));
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
    let currentState = gameState;
    let totalPoints = 0;
    const marksThisTurn: Record<number, number> = {};

    for (const dart of dartQueue) {
      const result = processCricketDart(currentState, dart);
      currentState = result.state;
      totalPoints += result.pointsScored;
      if (result.numberClosed !== null) {
        marksThisTurn[result.numberClosed] = (marksThisTurn[result.numberClosed] || 0) + result.marksAdded;
      }
      if (soundEnabled) {
        if (result.numberClosed) voiceCaller.callCricketNumber(result.numberClosed, 3);
        else if (result.marksAdded > 0 && result.pointsScored === 0) voiceCaller.speak(`${result.marksAdded}`);
        else if (result.pointsScored > 0) voiceCaller.callScore(result.pointsScored);
      }
    }

    setGameState(currentState);
    setDartQueue([]);

    if (Object.keys(marksThisTurn).length > 0 || totalPoints > 0) {
      setLastTurnResult({ player: playerName, marks: marksThisTurn, points: totalPoints });
      setShowTurnResult(true);
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      resultTimerRef.current = setTimeout(() => setShowTurnResult(false), 2500);
    }

    if (currentState.dartsThrown >= 3) {
      setTimeout(() => {
        const newState = endCricketTurn(currentState);
        setGameState(newState);
        if (newState.winner && soundEnabled) {
          const winner = newState.players.find((p) => p.id === newState.winner);
          voiceCaller.callGameShot(winner?.name);
        }
        setIsProcessing(false);
      }, 500);
    } else {
      setIsProcessing(false);
    }
  };

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  const getNumberStatus = (num: number) => {
    const closedByAll = gameState.players.every((p) => p.marks[num] >= 3);
    const closedByCurrent = currentPlayer.marks[num] >= 3;
    return { closedByAll, closedByCurrent };
  };

  const getLeader = () => {
    if (gameState.isCutthroat) {
      return gameState.players.reduce((min, p) => p.points < min.points ? p : min, gameState.players[0]);
    }
    return gameState.players.reduce((max, p) => p.points > max.points ? p : max, gameState.players[0]);
  };

  const leader = getLeader();

  return (
    <div className="space-y-4 animate-fade-in pb-20 md:pb-4">
      {showTurnResult && lastTurnResult && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-dark-900 dark:bg-white text-white dark:text-dark-900 px-5 py-3 rounded-xl shadow-2xl animate-fade-in pointer-events-none">
          <p className="text-sm font-semibold">{lastTurnResult.player}</p>
          <div className="flex items-center gap-3 mt-1">
            {Object.entries(lastTurnResult.marks).map(([num, marks]) => (
              <span key={num} className="text-sm">
                {num === '25' ? 'Bull' : num}: <span className="font-bold text-success-400 dark:text-success-600">+{marks} mark</span>
              </span>
            ))}
            {lastTurnResult.points > 0 && (
              <span className="text-sm font-bold text-primary-400 dark:text-primary-600">+{lastTurnResult.points} pont</span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/party-games')} leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Vissza
        </Button>
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-dark-600 dark:text-dark-300">Cricket</span>
          {gameState.isCutthroat && (
            <span className="text-xs bg-error-100 dark:bg-error-900/30 text-error-600 dark:text-error-400 px-2 py-0.5 rounded-full font-medium">Cutthroat</span>
          )}
          <span className="text-xs text-dark-400 ml-1">{gameState.round}. kör</span>
          <button onClick={() => setShowLegend(!showLegend)} className="ml-1 p-1.5 rounded-lg text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700">
            <HelpCircle className="w-4 h-4" />
          </button>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700">
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {showLegend && (
        <Card className="p-3 bg-dark-50 dark:bg-dark-800">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-dark-600 dark:text-dark-300">Jelölések magyarázata</p>
            <button onClick={() => setShowLegend(false)}><X className="w-4 h-4 text-dark-400" /></button>
          </div>
          <MarksLegend />
          <p className="text-xs text-dark-500 mt-2">
            {gameState.isCutthroat
              ? 'Cutthroat: Ha bezárt számodon dobsz, az ellenfeleid kapják a pontot!'
              : 'Standard: 3 mark = szám bezárva. Ezután minden dobás pontot ér neked.'}
          </p>
        </Card>
      )}

      {gameState.winner && (
        <Card className="bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800">
          <div className="text-center py-6">
            <Trophy className="w-12 h-12 text-success-500 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-success-700 dark:text-success-400">
              {gameState.players.find((p) => p.id === gameState.winner)?.name} nyert!
            </h2>
            <p className="text-success-600 dark:text-success-500 mt-1 text-sm">
              Végeredmény: {gameState.players.sort((a, b) => b.points - a.points).map(p => `${p.name}: ${p.points}`).join(' · ')}
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-dark-50 dark:bg-dark-800/50 border-b border-dark-200 dark:border-dark-700">
                    <th className="py-2.5 px-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wide">Játékos</th>
                    {CRICKET_NUMBERS.map((num) => {
                      const { closedByAll } = getNumberStatus(num);
                      return (
                        <th key={num} className={`py-2.5 px-2 text-center text-xs font-bold uppercase tracking-wide ${
                          closedByAll ? 'text-dark-300 dark:text-dark-600 line-through' : 'text-dark-700 dark:text-dark-200'
                        }`}>
                          {num === 25 ? 'B' : num}
                        </th>
                      );
                    })}
                    <th className="py-2.5 px-3 text-right text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wide">Pont</th>
                  </tr>
                </thead>
                <tbody>
                  {gameState.players.map((player, idx) => {
                    const isLeader = player.id === leader.id && gameState.players.some(p => p.points > 0 || gameState.players.some(q => q.points !== p.points));
                    return (
                      <tr key={player.id} className={`border-b border-dark-100 dark:border-dark-800 transition-colors ${
                        idx === gameState.currentPlayerIndex ? 'bg-primary-50/70 dark:bg-primary-900/15' : 'hover:bg-dark-50/50 dark:hover:bg-dark-800/30'
                      }`}>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {idx === gameState.currentPlayerIndex && (
                              <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse flex-shrink-0" />
                            )}
                            {isLeader && idx !== gameState.currentPlayerIndex && (
                              <Trophy className="w-3.5 h-3.5 text-warning-500 flex-shrink-0" />
                            )}
                            <span className="font-medium text-dark-900 dark:text-white truncate text-sm">{player.name}</span>
                          </div>
                        </td>
                        {CRICKET_NUMBERS.map((num) => {
                          const marks = player.marks[num];
                          const { closedByAll } = getNumberStatus(num);
                          return (
                            <td key={num} className="py-3 px-2 text-center">
                              <span className={`text-lg font-bold font-mono leading-none ${
                                marks >= 3
                                  ? closedByAll ? 'text-dark-300 dark:text-dark-600' : 'text-success-500 dark:text-success-400'
                                  : marks > 0 ? 'text-dark-600 dark:text-dark-300' : 'text-dark-200 dark:text-dark-700'
                              }`}>
                                {getCricketMarksDisplay(marks) || (closedByAll ? '' : '·')}
                              </span>
                            </td>
                          );
                        })}
                        <td className="py-3 px-3 text-right">
                          <span className={`font-bold tabular-nums text-lg ${
                            isLeader ? 'text-primary-600 dark:text-primary-400' : 'text-dark-700 dark:text-dark-300'
                          }`}>{player.points}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
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
                  <p className="text-xl font-bold text-dark-900 dark:text-white tabular-nums">{gameState.turnPoints}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-500">Összpont</p>
                  <p className="text-xl font-bold text-primary-600 dark:text-primary-400 tabular-nums">{currentPlayer.points}</p>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-dark-100 dark:border-dark-700">
              <div className="flex flex-wrap gap-1.5">
                {CRICKET_NUMBERS.map(num => {
                  const marks = currentPlayer.marks[num];
                  const { closedByAll } = getNumberStatus(num);
                  const label = num === 25 ? 'Bull' : `${num}`;
                  if (closedByAll) return null;
                  return (
                    <span key={num} className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                      marks >= 3
                        ? 'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400'
                        : 'bg-dark-100 dark:bg-dark-700 text-dark-500 dark:text-dark-400'
                    }`}>
                      {label} {marks >= 3 ? '✓' : `${getCricketMarksDisplay(marks) || '○'}`}
                    </span>
                  );
                })}
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
