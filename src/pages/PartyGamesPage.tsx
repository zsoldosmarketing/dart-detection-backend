import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  Users,
  Skull,
  Zap,
  MapPin,
  Play,
  Minus,
  Plus,
  ChevronRight,
} from 'lucide-react';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';

type GameType = 'cricket' | 'halve-it' | 'killer' | 'knockout' | 'shanghai';

interface GameMode {
  id: GameType;
  name: string;
  description: string;
  icon: React.ReactNode;
  minPlayers: number;
  maxPlayers: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

const GAME_MODES: GameMode[] = [
  {
    id: 'cricket',
    name: 'Cricket',
    description: 'Zárd le a számokat és szerezz pontokat! A klasszikus darts játék.',
    icon: <Target className="w-6 h-6" />,
    minPlayers: 2,
    maxPlayers: 8,
    difficulty: 'medium',
  },
  {
    id: 'halve-it',
    name: 'Halve-It',
    description: 'Találj célba minden körben, különben feleződik a pontod!',
    icon: <Zap className="w-6 h-6" />,
    minPlayers: 2,
    maxPlayers: 8,
    difficulty: 'easy',
  },
  {
    id: 'killer',
    name: 'Killer',
    description: 'Valj gyilkossa es iktasd ki ellenfeleidet!',
    icon: <Skull className="w-6 h-6" />,
    minPlayers: 3,
    maxPlayers: 10,
    difficulty: 'medium',
  },
  {
    id: 'knockout',
    name: 'Knockout',
    description: 'A legalacsonyabb pontszam kiesik minden korben.',
    icon: <Users className="w-6 h-6" />,
    minPlayers: 3,
    maxPlayers: 10,
    difficulty: 'easy',
  },
  {
    id: 'shanghai',
    name: 'Shanghai',
    description: 'Menj végig az összes számon. Shanghai = azonnali győzelem!',
    icon: <MapPin className="w-6 h-6" />,
    minPlayers: 2,
    maxPlayers: 8,
    difficulty: 'hard',
  },
];

export function PartyGamesPage() {
  const navigate = useNavigate();
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null);
  const [playerCount, setPlayerCount] = useState(2);
  const [playerNames, setPlayerNames] = useState<string[]>(['', '']);
  const [gameOptions, setGameOptions] = useState({
    cricketCutthroat: false,
    killerLives: 3,
    shanghaiRounds: 20,
  });

  const selectedGameMode = GAME_MODES.find((g) => g.id === selectedGame);

  const handlePlayerCountChange = (count: number) => {
    const newCount = Math.max(selectedGameMode?.minPlayers || 2, Math.min(selectedGameMode?.maxPlayers || 8, count));
    setPlayerCount(newCount);

    const newNames = [...playerNames];
    while (newNames.length < newCount) {
      newNames.push('');
    }
    while (newNames.length > newCount) {
      newNames.pop();
    }
    setPlayerNames(newNames);
  };

  const handlePlayerNameChange = (index: number, name: string) => {
    const newNames = [...playerNames];
    newNames[index] = name;
    setPlayerNames(newNames);
  };

  const handleStartGame = () => {
    if (!selectedGame) return;

    const names = playerNames.map((name, idx) => name.trim() || `Játékos ${idx + 1}`);

    const gameData = {
      type: selectedGame,
      players: names,
      options: gameOptions,
    };

    sessionStorage.setItem('partyGameData', JSON.stringify(gameData));
    navigate(`/party-game/${selectedGame}`);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'success';
      case 'medium': return 'warning';
      case 'hard': return 'error';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Party Játékok</h1>
        <p className="text-dark-500 dark:text-dark-400 mt-1">
          Válassz egy játékmódot és hívd meg barátaidat!
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {GAME_MODES.map((game) => (
          <button
            key={game.id}
            onClick={() => {
              setSelectedGame(game.id);
              handlePlayerCountChange(game.minPlayers);
            }}
            className={`p-6 rounded-xl border-2 text-left transition-all ${
              selectedGame === game.id
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-dark-200 dark:border-dark-700 hover:border-dark-300 dark:hover:border-dark-600'
            }`}
          >
            <div className="flex items-start justify-between">
              <div
                className={`p-3 rounded-lg ${
                  selectedGame === game.id
                    ? 'bg-primary-100 dark:bg-primary-800/30 text-primary-600'
                    : 'bg-dark-100 dark:bg-dark-700 text-dark-500'
                }`}
              >
                {game.icon}
              </div>
              <Badge variant={getDifficultyColor(game.difficulty) as any} size="sm">
                {game.difficulty === 'easy' ? 'Könnyű' : game.difficulty === 'medium' ? 'Közepes' : 'Nehéz'}
              </Badge>
            </div>
            <h3 className="font-bold text-dark-900 dark:text-white mt-4 text-lg">{game.name}</h3>
            <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">{game.description}</p>
            <div className="flex items-center gap-2 mt-3 text-xs text-dark-400">
              <Users className="w-3 h-3" />
              <span>{game.minPlayers}-{game.maxPlayers} játékos</span>
            </div>
          </button>
        ))}
      </div>

      {selectedGame && selectedGameMode && (
        <Card>
          <CardTitle className="flex items-center gap-2">
            {selectedGameMode.icon}
            {selectedGameMode.name} beállítások
          </CardTitle>

          <div className="mt-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-3">
                Játékosok száma
              </label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handlePlayerCountChange(playerCount - 1)}
                  disabled={playerCount <= selectedGameMode.minPlayers}
                  className="p-2 rounded-lg bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600 disabled:opacity-50"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <span className="text-2xl font-bold text-dark-900 dark:text-white w-12 text-center">
                  {playerCount}
                </span>
                <button
                  onClick={() => handlePlayerCountChange(playerCount + 1)}
                  disabled={playerCount >= selectedGameMode.maxPlayers}
                  className="p-2 rounded-lg bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600 disabled:opacity-50"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-3">
                Játékos nevek
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                {playerNames.map((name, idx) => (
                  <Input
                    key={idx}
                    placeholder={`Játékos ${idx + 1}`}
                    value={name}
                    onChange={(e) => handlePlayerNameChange(idx, e.target.value)}
                  />
                ))}
              </div>
            </div>

            {selectedGame === 'cricket' && (
              <div className="flex items-center justify-between p-4 bg-dark-50 dark:bg-dark-800 rounded-lg">
                <div>
                  <p className="font-medium text-dark-900 dark:text-white">Cutthroat mod</p>
                  <p className="text-sm text-dark-500 dark:text-dark-400">
                    Pontokat az ellenfelek kapják
                  </p>
                </div>
                <button
                  onClick={() => setGameOptions({ ...gameOptions, cricketCutthroat: !gameOptions.cricketCutthroat })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    gameOptions.cricketCutthroat ? 'bg-primary-600' : 'bg-dark-300 dark:bg-dark-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      gameOptions.cricketCutthroat ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            )}

            {selectedGame === 'killer' && (
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-3">
                  Életek száma
                </label>
                <div className="flex gap-2">
                  {[3, 4, 5].map((lives) => (
                    <button
                      key={lives}
                      onClick={() => setGameOptions({ ...gameOptions, killerLives: lives })}
                      className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                        gameOptions.killerLives === lives
                          ? 'bg-primary-600 text-white'
                          : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600'
                      }`}
                    >
                      {lives} élet
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedGame === 'shanghai' && (
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-3">
                  Körök száma
                </label>
                <div className="flex gap-2">
                  {[7, 10, 15, 20].map((rounds) => (
                    <button
                      key={rounds}
                      onClick={() => setGameOptions({ ...gameOptions, shanghaiRounds: rounds })}
                      className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                        gameOptions.shanghaiRounds === rounds
                          ? 'bg-primary-600 text-white'
                          : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600'
                      }`}
                    >
                      {rounds}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button
                size="lg"
                leftIcon={<Play className="w-5 h-5" />}
                onClick={handleStartGame}
              >
                Játék indítása
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
