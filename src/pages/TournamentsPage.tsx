import { useState, useEffect } from 'react';
import {
  Trophy,
  Plus,
  Calendar,
  Users,
  Clock,
  ChevronRight,
  Filter,
  Award,
  Target,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PushNotificationPrompt } from '../components/ui/PushNotificationPrompt';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { Tables } from '../lib/supabase';

type TournamentStatus = 'all' | 'registration' | 'in_progress' | 'completed';

const statusColors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning'> = {
  draft: 'default',
  registration: 'primary',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'default',
};

const statusLabels: Record<string, string> = {
  draft: 'Tervezet',
  registration: 'Regisztracio',
  in_progress: 'Folyamatban',
  completed: 'Befejezodott',
  cancelled: 'Torolve',
};

export function TournamentsPage() {
  const { user, profile } = useAuthStore();
  const [tournaments, setTournaments] = useState<Tables['tournaments'][]>([]);
  const [myEntries, setMyEntries] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TournamentStatus>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchTournaments();
  }, []);

  async function fetchTournaments() {
    setIsLoading(true);

    const { data: tournamentsData } = await supabase
      .from('tournaments')
      .select('*')
      .neq('status', 'draft')
      .order('created_at', { ascending: false });

    if (tournamentsData) setTournaments(tournamentsData);

    if (user) {
      const { data: entries } = await supabase
        .from('tournament_entries')
        .select('tournament_id')
        .eq('user_id', user.id)
        .neq('status', 'withdrawn');

      if (entries) {
        setMyEntries(entries.map((e) => e.tournament_id));
      }
    }

    setIsLoading(false);
  }

  const filteredTournaments = tournaments.filter(
    (t) => statusFilter === 'all' || t.status === statusFilter
  );

  const handleRegister = async (tournamentId: string) => {
    if (!user) return;

    const { error } = await supabase.from('tournament_entries').insert({
      tournament_id: tournamentId,
      user_id: user.id,
      status: 'registered',
    });

    if (!error) {
      setMyEntries([...myEntries, tournamentId]);
    }
  };

  const handleDelete = async (tournamentId: string) => {
    if (!confirm(t('tournament.delete_confirm'))) {
      return;
    }

    const { error } = await supabase
      .from('tournaments')
      .delete()
      .eq('id', tournamentId);

    if (!error) {
      fetchTournaments();
    }
  };

  const canCreateTournament = profile && (profile.skill_rating >= 6 || profile.is_admin);
  const isAdmin = profile?.is_admin === true;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">
            {t('nav.tournaments')}
          </h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            Csatlakozz tornakhoz es bizonyitsd a tudasod
          </p>
        </div>
        {canCreateTournament && (
          <Button
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowCreateModal(true)}
            disabled={!isAdmin}
          >
            {t('tournament.create')}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 md:flex md:gap-2">
        {(['all', 'registration', 'in_progress', 'completed'] as TournamentStatus[]).map(
          (status) => {
            const Icon =
              status === 'all'
                ? Filter
                : status === 'registration'
                ? Users
                : status === 'in_progress'
                ? Clock
                : Trophy;
            const label =
              status === 'all'
                ? 'Összes'
                : status === 'registration'
                ? 'Regisztráció'
                : status === 'in_progress'
                ? 'Folyamatban'
                : 'Befejezett';

            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-2 md:px-4 py-2.5 rounded-lg font-medium transition-all ${
                  statusFilter === status
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-700'
                }`}
              >
                <Icon className="w-5 h-5 md:w-4 md:h-4" />
                <span className="text-xs md:text-sm md:whitespace-nowrap">{label}</span>
              </button>
            );
          }
        )}
      </div>

      {filteredTournaments.length === 0 ? (
        <Card className="text-center py-12">
          <Trophy className="w-12 h-12 text-dark-400 mx-auto mb-4" />
          <p className="text-dark-500 dark:text-dark-400">
            Nincs megjelenitendo torna
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredTournaments.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              isRegistered={myEntries.includes(tournament.id)}
              onRegister={() => handleRegister(tournament.id)}
              onDelete={() => handleDelete(tournament.id)}
              currentUserId={user?.id}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateTournamentModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchTournaments();
          }}
        />
      )}

      <PushNotificationPrompt context="tournament" />
    </div>
  );
}

interface TournamentCardProps {
  tournament: Tables['tournaments'];
  isRegistered: boolean;
  onRegister: () => void;
  onDelete: () => void;
  currentUserId?: string;
}

function TournamentCard({ tournament, isRegistered, onRegister, onDelete, currentUserId }: TournamentCardProps) {
  const startsAt = tournament.starts_at ? new Date(tournament.starts_at) : null;

  return (
    <Card className="flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-shrink-0">
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-accent-400 to-warning-400 flex items-center justify-center">
          <Trophy className="w-8 h-8 text-white" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-dark-900 dark:text-white">
              {tournament.name}
            </h3>
            <Badge variant={statusColors[tournament.status]} size="sm" className="mt-1">
              {statusLabels[tournament.status]}
            </Badge>
          </div>
        </div>

        {tournament.description && (
          <p className="text-sm text-dark-500 dark:text-dark-400 mt-2 line-clamp-2">
            {tournament.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-dark-500">
          <div className="flex items-center gap-1">
            <Target className="w-4 h-4" />
            <span>{tournament.starting_score}</span>
          </div>
          <div className="flex items-center gap-1">
            <Award className="w-4 h-4" />
            <span>Best of {tournament.legs_per_match}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>Max {tournament.max_players}</span>
          </div>
          {startsAt && (
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{format(startsAt, 'MMM d, HH:mm', { locale: hu })}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center gap-2">
        {tournament.status === 'registration' && !isRegistered && (
          <Button onClick={onRegister}>{t('tournament.register')}</Button>
        )}
        {isRegistered && (
          <Badge variant="success" size="md">
            Regisztralva
          </Badge>
        )}
        {tournament.status === 'in_progress' && (
          <Button variant="outline" rightIcon={<ChevronRight className="w-4 h-4" />}>
            {t('tournament.bracket')}
          </Button>
        )}
        {tournament.status === 'completed' && (
          <Button variant="ghost" rightIcon={<ChevronRight className="w-4 h-4" />}>
            Eredmények
          </Button>
        )}
        {currentUserId &&
         tournament.created_by === currentUserId &&
         (tournament.status === 'draft' || tournament.status === 'registration') && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 text-error-600 hover:bg-error-50 dark:hover:bg-error-950 rounded-lg transition-colors"
            title="Torna törlése"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>
    </Card>
  );
}

interface CreateTournamentModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateTournamentModal({ onClose, onCreated }: CreateTournamentModalProps) {
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startingScore, setStartingScore] = useState(501);
  const [legsPerMatch, setLegsPerMatch] = useState(3);
  const [maxPlayers, setMaxPlayers] = useState(16);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!user || !name.trim()) return;

    setIsCreating(true);

    const { error } = await supabase.from('tournaments').insert({
      name: name.trim(),
      description: description.trim() || null,
      starting_score: startingScore,
      legs_per_match: legsPerMatch,
      max_players: maxPlayers,
      status: 'registration',
      created_by: user.id,
    });

    if (!error) {
      onCreated();
    }

    setIsCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md animate-scale-in max-h-[90vh] overflow-y-auto">
        <CardTitle>{t('tournament.create')}</CardTitle>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
              Torna neve
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="pl. Heti Kupa"
              className="w-full px-4 py-2.5 rounded-lg border border-dark-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
              Leiras
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg border border-dark-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              Kezdo pontszam
            </label>
            <div className="flex gap-2">
              {[301, 501, 701].map((score) => (
                <button
                  key={score}
                  onClick={() => setStartingScore(score)}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    startingScore === score
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400'
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
                Legek / meccs
              </label>
              <select
                value={legsPerMatch}
                onChange={(e) => setLegsPerMatch(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-lg border border-dark-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {[1, 3, 5, 7].map((n) => (
                  <option key={n} value={n}>
                    Best of {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
                Max játékosok
              </label>
              <select
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-lg border border-dark-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {[4, 8, 16, 32].map((n) => (
                  <option key={n} value={n}>
                    {n} játékos
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            className="flex-1"
            onClick={handleCreate}
            isLoading={isCreating}
            disabled={!name.trim()}
          >
            {t('common.create')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
