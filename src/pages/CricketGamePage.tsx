import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
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

export function CricketGamePage() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const [gameState, setGameState] = useState<CricketGameState | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dartQueue, setDartQueue] = useState<DartTarget[]>([]);

  useEffect(() => {
    const players = ['Player 1', 'Player 2'];
    const state = createCricketGame(players, { cutthroat: false, pointsMode: true });
    setGameState(state);
  }, []);

  const addToQueue = (dart: DartTarget) => {
    if (dartQueue.length >= 3) return;
    setDartQueue([...dartQueue, dart]);
  };

  const handleUndo = () => {
    if (dartQueue.length > 0) {
      setDartQueue(dartQueue.slice(0, -1));
    }
  };

  const handleSubmit = () => {
    if (!gameState || gameState.winner || isProcessing || dartQueue.length === 0) return;

    setIsProcessing(true);

    let currentState = gameState;
    for (const dart of dartQueue) {
      const result = processCricketDart(currentState, dart);
      currentState = result.state;

      if (soundEnabled) {
        if (result.numberClosed) {
          voiceCaller.callCricketNumber(result.numberClosed, 3);
        } else if (result.marksAdded > 0) {
          voiceCaller.speak(`${result.marksAdded} mark${result.marksAdded > 1 ? 's' : ''}`);
        }
      }
    }

    setGameState(currentState);
    setDartQueue([]);

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

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/game')} leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Vissza
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSoundEnabled(!soundEnabled)}
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </Button>
      </div>

      {gameState.winner && (
        <Card className="bg-success-50 dark:bg-success-900/20 border-success-500">
          <div className="text-center py-4">
            <h2 className="text-2xl font-bold text-success-600">
              {gameState.players.find((p) => p.id === gameState.winner)?.name} nyert!
            </h2>
            <Button className="mt-4" onClick={() => navigate('/game')}>
              Uj jatek
            </Button>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-200 dark:border-dark-700">
                    <th className="py-3 px-4 text-left font-semibold text-dark-600 dark:text-dark-300">
                      Jatekos
                    </th>
                    {CRICKET_NUMBERS.map((num) => (
                      <th key={num} className="py-3 px-2 text-center font-bold text-dark-900 dark:text-white">
                        {num === 25 ? 'B' : num}
                      </th>
                    ))}
                    <th className="py-3 px-4 text-right font-semibold text-dark-600 dark:text-dark-300">
                      Pont
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gameState.players.map((player, idx) => (
                    <tr
                      key={player.id}
                      className={`border-b border-dark-100 dark:border-dark-800 ${
                        idx === gameState.currentPlayerIndex
                          ? 'bg-primary-50 dark:bg-primary-900/20'
                          : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {idx === gameState.currentPlayerIndex && (
                            <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                          )}
                          <span className="font-medium text-dark-900 dark:text-white">
                            {player.name}
                          </span>
                        </div>
                      </td>
                      {CRICKET_NUMBERS.map((num) => (
                        <td key={num} className="py-3 px-2 text-center">
                          <span
                            className={`text-xl font-bold ${
                              player.marks[num] >= 3
                                ? 'text-success-500'
                                : 'text-dark-400 dark:text-dark-500'
                            }`}
                          >
                            {getCricketMarksDisplay(player.marks[num])}
                          </span>
                        </td>
                      ))}
                      <td className="py-3 px-4 text-right">
                        <span className="text-xl font-bold text-primary-600">{player.points}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-dark-500 dark:text-dark-400">Aktualis jatekos</p>
                <h3 className="text-xl font-bold text-dark-900 dark:text-white">{currentPlayer.name}</h3>
              </div>
              <div className="text-right">
                <p className="text-sm text-dark-500 dark:text-dark-400">Kor</p>
                <p className="text-lg font-semibold text-dark-900 dark:text-white">{gameState.round}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-dark-500 dark:text-dark-400">Dobott nyilak:</span>
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      gameState.turnDarts[i]
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600'
                        : 'bg-dark-100 dark:bg-dark-700 text-dark-400'
                    }`}
                  >
                    {gameState.turnDarts[i] || '-'}
                  </div>
                ))}
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
