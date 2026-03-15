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
  Info,
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
  rules: string;
  icon: React.ReactNode;
  minPlayers: number;
  maxPlayers: number;
  difficulty: 'easy' | 'medium' | 'hard';
  avgDuration: string;
}

const GAME_MODES: GameMode[] = [
  {
    id: 'cricket',
    name: 'Cricket',
    description: 'Zárd le a számokat és szerezz pontokat! A klasszikus darts játék.',
    rules: 'Találd el a 20, 19, 18, 17, 16, 15 számokat és a Bullt 3-szor. Utána pontozz velük. Aki bezárja az összes számot a legtöbb ponttal nyer.',
    icon: <Target className="w-6 h-6" />,
    minPlayers: 2,
    maxPlayers: 8,
    difficulty: 'medium',
    avgDuration: '20-40 perc',
  },
  {
    id: 'halve-it',
    name: 'Halve-It',
    description: 'Találj célba minden körben, különben feleződik a pontod!',
    rules: '9 körön át különböző célpontokat kell eltalálni. Ha nem sikerül, a pontszámod megfeleződik. A végén a legtöbb ponttal rendelkező nyer.',
    icon: <Zap className="w-6 h-6" />,
    minPlayers: 2,
    maxPlayers: 8,
    difficulty: 'easy',
    avgDuration: '15-25 perc',
  },
  {
    id: 'killer',
    name: 'Killer',
    description: 'Válj gyilkossá és iktasd ki ellenfeleidet!',
    rules: 'Először mindenki kap egy doublét (saját számát). Ezután el kell találni a saját doublét, hogy gyilkos legyél. Gyilkosként az ellenfelek doublejét kell eltalálni, hogy elveszítsék az életpontjaikat.',
    icon: <Skull className="w-6 h-6" />,
    minPlayers: 3,
    maxPlayers: 10,
    difficulty: 'medium',
    avgDuration: '25-45 perc',
  },
  {
    id: 'knockout',
    name: 'Knockout',
    description: 'A legalacsonyabb pontszám kiesik minden körben!',
    rules: 'Minden körben mindenki dob 3 nyilat. A legalacsonyabb pontszámú játékos kiesik. Az utolsó megmaradó nyeri a játékot.',
    icon: <Users className="w-6 h-6" />,
    minPlayers: 3,
    maxPlayers: 10,
    difficulty: 'easy',
    avgDuration: '15-30 perc',
  },
  {
    id: 'shanghai',
    name: 'Shanghai',
    description: 'Menj végig az összes számon. Shanghai = azonnali győzelem!',
    rules: 'Minden körben egy meghatározott számot kell eltalálni. Ha egy körben single-t, double-t és triple-t is elér valaki, az azonnal nyer (Shanghai). Különben a legtöbb pont nyer a végén.',
    icon: <MapPin className="w-6 h-6" />,
    minPlayers: 2,
    maxPlayers: 8,
    difficulty: 'hard',
    avgDuration: '20-35 perc',
  },
];

export function PartyGamesPage() {
  const navigate = useNavigate();
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null);
  const [playerCount, setPlayerCount] = useState(2);
  const [playerNames, setPlayerNames] = useState<string[]>(['', '']);
  const [showRules, setShowRules] = useState<GameType | null>(null);
  const [gameOptions, setGameOptions] = useState({
    cricketCutthroat: false,
    killerLives: 3,
    shanghaiRounds: 20,
    knockoutMode: 'lowest' as 'lowest' | 'below_average',
  });

  const selectedGameMode = GAME_MODES.find((g) => g.id === selectedGame);

  const handlePlayerCountChange = (count: number) => {
    const newCount = Math.max(selectedGameMode?.minPlayers || 2, Math.min(selectedGameMode?.maxPlayers || 8, count));
    setPlayerCount(newCount);
    const newNames = [...playerNames];
    while (newNames.length < newCount) newNames.push('');
    while (newNames.length > newCount) newNames.pop();
    setPlayerNames(newNames);
  };

  const handleGameSelect = (game: GameMode) => {
    setSelectedGame(game.id);
    const minPlayers = game.minPlayers;
    const newCount = Math.max(minPlayers, playerCount);
    setPlayerCount(newCount);
    const newNames = [...playerNames];
    while (newNames.length < newCount) newNames.push('');
    while (newNames.length > newCount) newNames.pop();
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
    sessionStorage.setItem('partyGameData', JSON.stringify({
      type: selectedGame,
      players: names,
      options: gameOptions,
    }));
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

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'Könnyű';
      case 'medium': return 'Közepes';
      case 'hard': return 'Nehéz';
      default: return '';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Party Játékok</h1>
        <p className="text-dark-500 dark:text-dark-400 mt-1">
          Válassz egy játékmódot és hívd meg barátaidat!
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {GAME_MODES.map((game) => (
          <div key={game.id} className="relative">
            <button
              onClick={() => handleGameSelect(game)}
              className={`w-full p-5 rounded-xl border-2 text-left transition-all ${
                selectedGame === game.id
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md'
                  : 'border-dark-200 dark:border-dark-700 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm bg-white dark:bg-dark-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-xl ${
                  selectedGame === game.id
                    ? 'bg-primary-100 dark:bg-primary-800/40 text-primary-600 dark:text-primary-400'
                    : 'bg-dark-100 dark:bg-dark-700 text-dark-500 dark:text-dark-400'
                }`}>
                  {game.icon}
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={getDifficultyColor(game.difficulty) as any} size="sm">
                    {getDifficultyLabel(game.difficulty)}
                  </Badge>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowRules(showRules === game.id ? null : game.id); }}
                    className="p-1 rounded-lg text-dark-400 hover:text-dark-600 dark:hover:text-dark-200 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-dark-900 dark:text-white mt-3 text-lg">{game.name}</h3>
              <p className="text-sm text-dark-500 dark:text-dark-400 mt-1 leading-relaxed">{game.description}</p>

              <div className="flex items-center gap-4 mt-3 text-xs text-dark-400 dark:text-dark-500">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {game.minPlayers}–{game.maxPlayers} játékos
                </span>
                <span className="flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" />
                  {game.avgDuration}
                </span>
              </div>

              {selectedGame === game.id && (
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary-600 dark:text-primary-400">
                  <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                  Kiválasztva
                </div>
              )}
            </button>

            {showRules === game.id && (
              <div className="absolute z-10 top-full left-0 right-0 mt-2 p-4 bg-dark-900 dark:bg-dark-100 text-white dark:text-dark-900 rounded-xl shadow-2xl text-sm leading-relaxed">
                <p className="font-semibold mb-1">Szabályok</p>
                <p className="text-dark-300 dark:text-dark-600">{game.rules}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedGame && selectedGameMode && (
        <Card>
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
              {selectedGameMode.icon}
            </div>
            <div>
              <span>{selectedGameMode.name} beállítások</span>
              <p className="text-sm font-normal text-dark-500 dark:text-dark-400 mt-0.5">{selectedGameMode.avgDuration}</p>
            </div>
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
                  className="w-10 h-10 rounded-xl bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600 disabled:opacity-40 flex items-center justify-center transition-colors"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <span className="text-3xl font-bold text-dark-900 dark:text-white w-12 text-center tabular-nums">
                  {playerCount}
                </span>
                <button
                  onClick={() => handlePlayerCountChange(playerCount + 1)}
                  disabled={playerCount >= selectedGameMode.maxPlayers}
                  className="w-10 h-10 rounded-xl bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600 disabled:opacity-40 flex items-center justify-center transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
                <span className="text-sm text-dark-400">
                  (min {selectedGameMode.minPlayers}, max {selectedGameMode.maxPlayers})
                </span>
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
              <div className="space-y-3">
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300">
                  Játék mód
                </label>
                <div className="flex items-center justify-between p-4 bg-dark-50 dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700">
                  <div>
                    <p className="font-medium text-dark-900 dark:text-white">Cutthroat mód</p>
                    <p className="text-sm text-dark-500 dark:text-dark-400 mt-0.5">
                      A pontok az ellenfeleknél jelennek meg — aki bezárja előbb, az nyertes a legkevesebb ponttal.
                    </p>
                  </div>
                  <button
                    onClick={() => setGameOptions({ ...gameOptions, cricketCutthroat: !gameOptions.cricketCutthroat })}
                    className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors ml-4 ${
                      gameOptions.cricketCutthroat ? 'bg-primary-600' : 'bg-dark-300 dark:bg-dark-600'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      gameOptions.cricketCutthroat ? 'translate-x-7' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
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
                      className={`flex-1 py-3 rounded-xl font-bold transition-all text-sm ${
                        gameOptions.killerLives === lives
                          ? 'bg-primary-600 text-white shadow-md'
                          : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600'
                      }`}
                    >
                      {lives} élet
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedGame === 'knockout' && (
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-3">
                  Kiesési mód
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setGameOptions({ ...gameOptions, knockoutMode: 'lowest' })}
                    className={`p-3 rounded-xl text-left transition-all border-2 ${
                      gameOptions.knockoutMode === 'lowest'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-dark-200 dark:border-dark-700 hover:border-dark-300'
                    }`}
                  >
                    <p className="font-semibold text-dark-900 dark:text-white text-sm">Legalacsonyabb</p>
                    <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">A legkevesebb pontot dobó kiesik</p>
                  </button>
                  <button
                    onClick={() => setGameOptions({ ...gameOptions, knockoutMode: 'below_average' })}
                    className={`p-3 rounded-xl text-left transition-all border-2 ${
                      gameOptions.knockoutMode === 'below_average'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-dark-200 dark:border-dark-700 hover:border-dark-300'
                    }`}
                  >
                    <p className="font-semibold text-dark-900 dark:text-white text-sm">Átlag alatt</p>
                    <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">Az átlag alatti pontszámú játékosok kiesnek</p>
                  </button>
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
                      className={`flex-1 py-3 rounded-xl font-bold transition-all text-sm ${
                        gameOptions.shanghaiRounds === rounds
                          ? 'bg-primary-600 text-white shadow-md'
                          : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-600'
                      }`}
                    >
                      {rounds}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-dark-400 mt-2">1-es számon kezdve, minden körben a következő számot kell eltalálni.</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-dark-100 dark:border-dark-700">
              <div className="text-sm text-dark-500">
                <span className="font-medium">{playerCount} játékos</span>
                {' · '}
                <span>{selectedGameMode.avgDuration}</span>
              </div>
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
