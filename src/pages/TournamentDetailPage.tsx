import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Trophy,
  Users,
  Calendar,
  Clock,
  ArrowLeft,
  UserPlus,
  Crown,
  Target,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import clsx from 'clsx';

interface Tournament {
  id: string;
  name: string;
  description: string | null;
  game_type: string;
  starting_score: number;
  legs_per_match: number;
  sets_per_match: number;
  format: string;
  min_players: number;
  max_players: number;
  entry_fee_tokens: number;
  prize_pool_tokens: number;
  status: string;
  registration_starts_at: string | null;
  registration_ends_at: string | null;
  starts_at: string | null;
  completed_at: string | null;
  winner_id: string | null;
  created_by: string;
}

interface TournamentEntry {
  id: string;
  user_id: string;
  status: string;
  seed: number | null;
  final_position: number | null;
  user_profile: {
    display_name: string | null;
    skill_rating: number;
  } | null;
}

interface TournamentBracket {
  id: string;
  round_number: number;
  match_number: number;
  player1_entry_id: string | null;
  player2_entry_id: string | null;
  winner_entry_id: string | null;
  status: string;
}

export function TournamentDetailPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [entries, setEntries] = useState<TournamentEntry[]>([]);
  const [brackets, setBrackets] = useState<TournamentBracket[]>([]);
  const [userEntry, setUserEntry] = useState<TournamentEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'bracket' | 'participants'>('info');

  useEffect(() => {
    if (tournamentId) {
      fetchTournamentData();
    }
  }, [tournamentId, user]);

  const fetchTournamentData = async () => {
    if (!tournamentId) return;

    setIsLoading(true);

    const { data: tournamentData } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .maybeSingle();

    if (tournamentData) {
      setTournament(tournamentData);

      const { data: entriesData } = await supabase
        .from('tournament_entries')
        .select(`
          *,
          user_profile:user_id (
            display_name,
            skill_rating
          )
        `)
        .eq('tournament_id', tournamentId)
        .order('seed', { ascending: true });

      setEntries(entriesData || []);

      if (user) {
        const entry = entriesData?.find(e => e.user_id === user.id);
        setUserEntry(entry || null);
      }

      const { data: bracketsData } = await supabase
        .from('tournament_brackets')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('round_number', { ascending: true })
        .order('match_number', { ascending: true });

      setBrackets(bracketsData || []);
    }

    setIsLoading(false);
  };

  const handleRegister = async () => {
    if (!user || !tournament) return;

    const { error } = await supabase.from('tournament_entries').insert({
      tournament_id: tournament.id,
      user_id: user.id,
      status: 'registered',
    });

    if (!error) {
      fetchTournamentData();
    }
  };

  const handleWithdraw = async () => {
    if (!userEntry) return;

    const { error } = await supabase
      .from('tournament_entries')
      .update({ status: 'withdrawn' })
      .eq('id', userEntry.id);

    if (!error) {
      fetchTournamentData();
    }
  };

  const handleDelete = async () => {
    if (!tournament || !user) return;

    if (!confirm('Biztosan torlod ezt a tornat? Ez a muvelet nem visszavonhato.')) {
      return;
    }

    const { error } = await supabase
      .from('tournaments')
      .delete()
      .eq('id', tournament.id);

    if (!error) {
      navigate('/tournaments');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge>Tervezet</Badge>;
      case 'registration': return <Badge variant="primary">Regisztracio</Badge>;
      case 'in_progress': return <Badge variant="warning">Folyamatban</Badge>;
      case 'completed': return <Badge variant="success">Befejezve</Badge>;
      case 'cancelled': return <Badge variant="error">Torolve</Badge>;
      default: return null;
    }
  };

  const getEntryByPlayer = (entryId: string | null) => {
    return entries.find(e => e.id === entryId);
  };

  const roundsCount = brackets.length > 0
    ? Math.max(...brackets.map(b => b.round_number))
    : 0;

  const getRoundName = (round: number) => {
    const totalRounds = roundsCount;
    if (round === totalRounds) return 'Donto';
    if (round === totalRounds - 1) return 'Elodonto';
    if (round === totalRounds - 2) return 'Negyeddonto';
    return `${round}. Kor`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <Card className="p-8 text-center">
        <Trophy className="w-12 h-12 text-dark-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">
          Torna nem talalhato
        </h3>
        <Button variant="outline" onClick={() => navigate('/tournaments')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Vissza a tornakhoz
        </Button>
      </Card>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 md:pb-6">
      <button
        onClick={() => navigate('/tournaments')}
        className="flex items-center gap-2 text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Vissza
      </button>

      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-warning-400 to-warning-600 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-dark-900 dark:text-white">
                  {tournament.name}
                </h1>
                {getStatusBadge(tournament.status)}
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-dark-500">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {entries.filter(e => e.status === 'registered' || e.status === 'checked_in').length}/{tournament.max_players}
                </span>
                <span className="flex items-center gap-1">
                  <Target className="w-4 h-4" />
                  {tournament.starting_score}
                </span>
                {tournament.entry_fee_tokens > 0 && (
                  <span>{tournament.entry_fee_tokens} token</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tournament.status === 'registration' && !userEntry && (
              <Button onClick={handleRegister}>
                <UserPlus className="w-4 h-4 mr-2" />
                Jelentkezes
              </Button>
            )}
            {userEntry && userEntry.status === 'registered' && tournament.status === 'registration' && (
              <Button variant="outline" onClick={handleWithdraw}>
                Visszalepes
              </Button>
            )}
            {userEntry && (
              <Badge variant="success" className="ml-2">Regisztralt</Badge>
            )}
            {user && tournament.created_by === user.id &&
             (tournament.status === 'draft' || tournament.status === 'registration') && (
              <Button variant="outline" onClick={handleDelete} className="text-error-600 hover:bg-error-50 dark:hover:bg-error-950">
                <Trash2 className="w-4 h-4 mr-2" />
                Torles
              </Button>
            )}
          </div>
        </div>

        {tournament.description && (
          <p className="mt-4 text-dark-600 dark:text-dark-400">{tournament.description}</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {tournament.starts_at && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-dark-400" />
              <div>
                <p className="text-xs text-dark-400">Kezdes</p>
                <p className="text-sm font-medium text-dark-900 dark:text-white">
                  {format(new Date(tournament.starts_at), 'MMM d, HH:mm', { locale: hu })}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-dark-400" />
            <div>
              <p className="text-xs text-dark-400">Formatum</p>
              <p className="text-sm font-medium text-dark-900 dark:text-white">
                {tournament.legs_per_match} leg / meccs
              </p>
            </div>
          </div>
          {tournament.prize_pool_tokens > 0 && (
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-warning-500" />
              <div>
                <p className="text-xs text-dark-400">Nyeremeny</p>
                <p className="text-sm font-medium text-dark-900 dark:text-white">
                  {tournament.prize_pool_tokens} token
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="flex gap-2 border-b border-dark-200 dark:border-dark-700">
        {(['info', 'bracket', 'participants'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-dark-500 hover:text-dark-700 dark:hover:text-dark-300'
            )}
          >
            {tab === 'info' && 'Informacio'}
            {tab === 'bracket' && 'Tablazat'}
            {tab === 'participants' && 'Resztvevok'}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
              Torna szabalyok
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-dark-500">Jatek tipus</span>
                <span className="font-medium text-dark-900 dark:text-white">
                  {tournament.game_type.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-500">Kezdo pont</span>
                <span className="font-medium text-dark-900 dark:text-white">
                  {tournament.starting_score}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-500">Leg / meccs</span>
                <span className="font-medium text-dark-900 dark:text-white">
                  {tournament.legs_per_match}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-500">Formatum</span>
                <span className="font-medium text-dark-900 dark:text-white">
                  {tournament.format === 'single_elimination' ? 'Egyenes kieseses' :
                   tournament.format === 'double_elimination' ? 'Dupla kieseses' : 'Kormekkozos'}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
              Idopontok
            </h3>
            <div className="space-y-3">
              {tournament.registration_starts_at && (
                <div className="flex justify-between">
                  <span className="text-dark-500">Regisztracio kezdete</span>
                  <span className="font-medium text-dark-900 dark:text-white">
                    {format(new Date(tournament.registration_starts_at), 'MMM d, HH:mm', { locale: hu })}
                  </span>
                </div>
              )}
              {tournament.registration_ends_at && (
                <div className="flex justify-between">
                  <span className="text-dark-500">Regisztracio vege</span>
                  <span className="font-medium text-dark-900 dark:text-white">
                    {format(new Date(tournament.registration_ends_at), 'MMM d, HH:mm', { locale: hu })}
                  </span>
                </div>
              )}
              {tournament.starts_at && (
                <div className="flex justify-between">
                  <span className="text-dark-500">Torna kezdete</span>
                  <span className="font-medium text-dark-900 dark:text-white">
                    {format(new Date(tournament.starts_at), 'MMM d, HH:mm', { locale: hu })}
                  </span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'bracket' && (
        <div className="overflow-x-auto">
          {brackets.length === 0 ? (
            <Card className="p-8 text-center">
              <Trophy className="w-12 h-12 text-dark-400 mx-auto mb-4" />
              <p className="text-dark-500">
                A torna tablazat meg nem keszult el.
              </p>
            </Card>
          ) : (
            <div className="flex gap-8 min-w-max p-4">
              {Array.from({ length: roundsCount }, (_, i) => i + 1).map(round => {
                const roundBrackets = brackets.filter(b => b.round_number === round);
                return (
                  <div key={round} className="flex flex-col gap-4">
                    <h4 className="text-sm font-semibold text-dark-500 text-center">
                      {getRoundName(round)}
                    </h4>
                    <div className="flex flex-col gap-4 justify-around flex-1">
                      {roundBrackets.map(bracket => {
                        const player1 = getEntryByPlayer(bracket.player1_entry_id);
                        const player2 = getEntryByPlayer(bracket.player2_entry_id);
                        const winner = getEntryByPlayer(bracket.winner_entry_id);

                        return (
                          <Card key={bracket.id} className="w-48 p-2">
                            <div className={clsx(
                              'p-2 rounded text-sm',
                              winner?.id === player1?.id && 'bg-success-500/10 text-success-600 dark:text-success-400',
                              winner?.id === player2?.id && 'text-dark-400'
                            )}>
                              {player1?.user_profile?.display_name || 'TBD'}
                            </div>
                            <div className="border-t border-dark-200 dark:border-dark-700 my-1" />
                            <div className={clsx(
                              'p-2 rounded text-sm',
                              winner?.id === player2?.id && 'bg-success-500/10 text-success-600 dark:text-success-400',
                              winner?.id === player1?.id && 'text-dark-400'
                            )}>
                              {player2?.user_profile?.display_name || 'TBD'}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'participants' && (
        <div className="space-y-2">
          {entries
            .filter(e => e.status !== 'withdrawn' && e.status !== 'disqualified')
            .map((entry, index) => (
              <Card key={entry.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={clsx(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                      index === 0 && entry.final_position === 1 && 'bg-warning-500 text-white',
                      index === 1 && entry.final_position === 2 && 'bg-dark-300 text-dark-700',
                      index === 2 && entry.final_position === 3 && 'bg-amber-600 text-white',
                      (!entry.final_position || entry.final_position > 3) && 'bg-dark-100 dark:bg-dark-700 text-dark-500'
                    )}>
                      {entry.seed || index + 1}
                    </span>
                    <div>
                      <span className="font-medium text-dark-900 dark:text-white">
                        {entry.user_profile?.display_name || 'Ismeretlen'}
                      </span>
                      <p className="text-sm text-dark-500">
                        Skill: {entry.user_profile?.skill_rating?.toFixed(1) || '5.0'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {entry.final_position && (
                      <Badge variant={entry.final_position === 1 ? 'warning' : 'default'}>
                        #{entry.final_position}
                      </Badge>
                    )}
                    {entry.status === 'eliminated' && !entry.final_position && (
                      <Badge variant="error">Kiesett</Badge>
                    )}
                    {entry.status === 'registered' && (
                      <Badge variant="success">Regisztralt</Badge>
                    )}
                  </div>
                </div>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
