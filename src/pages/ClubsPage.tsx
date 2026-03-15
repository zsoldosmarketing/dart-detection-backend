import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Plus,
  Search,
  Crown,
  Shield,
  Lock,
  Globe,
  UserPlus,
  ChevronRight,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { Tables } from '../lib/supabase';

export function ClubsPage() {
  const { user } = useAuthStore();
  const [clubs, setClubs] = useState<Tables['clubs'][]>([]);
  const [myClubs, setMyClubs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchClubs();
  }, []);

  async function fetchClubs() {
    setIsLoading(true);

    const { data: clubsData } = await supabase
      .from('clubs')
      .select('*')
      .eq('is_active', true)
      .order('total_members', { ascending: false });

    if (clubsData) setClubs(clubsData);

    if (user) {
      const { data: memberships } = await supabase
        .from('club_members')
        .select('club_id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (memberships) {
        setMyClubs(memberships.map((m) => m.club_id));
      }
    }

    setIsLoading(false);
  }

  const filteredClubs = clubs.filter((club) =>
    club.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const joinedClubs = filteredClubs.filter((c) => myClubs.includes(c.id));
  const otherClubs = filteredClubs.filter((c) => !myClubs.includes(c.id));

  const handleJoinClub = async (clubId: string, joinPolicy: string) => {
    if (!user) return;

    const status = joinPolicy === 'open' ? 'active' : 'pending';

    const { error } = await supabase.from('club_members').insert({
      club_id: clubId,
      user_id: user.id,
      role: 'member',
      status,
    });

    if (!error) {
      if (status === 'active') {
        setMyClubs([...myClubs, clubId]);
        await supabase
          .from('clubs')
          .update({ total_members: clubs.find((c) => c.id === clubId)!.total_members + 1 })
          .eq('id', clubId);
      }
      fetchClubs();
    }
  };

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
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">{t('nav.clubs')}</h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            Csatlakozz egy klubhoz vagy hozd letre a sajatod
          </p>
        </div>
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setShowCreateModal(true)}
          disabled
        >
          {t('club.create')}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Klub keresese..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-dark-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {joinedClubs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
            Klubjaim ({joinedClubs.length})
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {joinedClubs.map((club) => (
              <ClubCard key={club.id} club={club} isMember />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
          {joinedClubs.length > 0 ? 'Többi klub' : 'Összes klub'} ({otherClubs.length})
        </h2>
        {otherClubs.length === 0 ? (
          <Card className="text-center py-12">
            <Users className="w-12 h-12 text-dark-400 mx-auto mb-4" />
            <p className="text-dark-500 dark:text-dark-400">
              {searchQuery ? 'Nincs találat' : 'Még nincsenek klubok'}
            </p>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherClubs.map((club) => (
              <ClubCard
                key={club.id}
                club={club}
                onJoin={() => handleJoinClub(club.id, club.join_policy)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateClubModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchClubs();
          }}
        />
      )}
    </div>
  );
}

interface ClubCardProps {
  club: Tables['clubs'];
  isMember?: boolean;
  onJoin?: () => void;
}

function ClubCard({ club, isMember, onJoin }: ClubCardProps) {
  const policyIcons = {
    open: <Globe className="w-4 h-4" />,
    request: <UserPlus className="w-4 h-4" />,
    invite: <Lock className="w-4 h-4" />,
  };

  return (
    <Card hover={isMember} className="flex flex-col">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center text-white font-bold text-lg">
          {club.name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-dark-900 dark:text-white truncate">
            {club.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="default" size="sm">
              {policyIcons[club.join_policy as keyof typeof policyIcons]}
              <span className="ml-1">{t(`club.policy.${club.join_policy}`)}</span>
            </Badge>
          </div>
        </div>
      </div>

      {club.description && (
        <p className="text-sm text-dark-500 dark:text-dark-400 mt-3 line-clamp-2">
          {club.description}
        </p>
      )}

      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-dark-200 dark:border-dark-700 text-sm text-dark-500">
        <div className="flex items-center gap-1">
          <Users className="w-4 h-4" />
          <span>{club.total_members}</span>
        </div>
        <div className="flex items-center gap-1">
          <Trophy className="w-4 h-4" />
          <span>{club.total_wins}</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="w-4 h-4" />
          <span>{club.average_skill?.toFixed(1) || '5.0'}</span>
        </div>
      </div>

      <div className="mt-4">
        {isMember ? (
          <Link to={`/clubs/${club.id}`}>
            <Button variant="outline" className="w-full" rightIcon={<ChevronRight className="w-4 h-4" />}>
              Megnyitas
            </Button>
          </Link>
        ) : (
          <Button
            className="w-full"
            onClick={onJoin}
            disabled={club.join_policy === 'invite'}
          >
            {club.join_policy === 'invite'
              ? 'Csak meghivassal'
              : club.join_policy === 'request'
              ? 'Csatlakozas kerese'
              : t('club.join')}
          </Button>
        )}
      </div>
    </Card>
  );
}

interface CreateClubModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateClubModal({ onClose, onCreated }: CreateClubModalProps) {
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [joinPolicy, setJoinPolicy] = useState<'open' | 'request' | 'invite'>('request');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!user || !name.trim()) return;

    setIsCreating(true);
    setError('');

    const { data: club, error: createError } = await supabase
      .from('clubs')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        join_policy: joinPolicy,
        created_by: user.id,
        total_members: 1,
      })
      .select()
      .single();

    if (createError) {
      setError(createError.message.includes('unique') ? 'Ez a klubnev mar foglalt' : 'Hiba tortent');
      setIsCreating(false);
      return;
    }

    await supabase.from('club_members').insert({
      club_id: club.id,
      user_id: user.id,
      role: 'owner',
      status: 'active',
    });

    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md animate-scale-in">
        <CardTitle>{t('club.create')}</CardTitle>

        <div className="mt-4 space-y-4">
          <Input
            label="Klub neve"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="pl. Magyar Darts Klub"
            error={error}
          />

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
              Leiras (opcionalis)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Rovid leiras a klubrol..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg border border-dark-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              Csatlakozási szabály
            </label>
            <div className="space-y-2">
              {[
                { value: 'open', label: 'Nyitott', desc: 'Bárki csatlakozhat' },
                { value: 'request', label: 'Kérelmes', desc: 'Elfogadás szükséges' },
                { value: 'invite', label: 'Csak meghívással', desc: 'Csak meghívott tagok' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setJoinPolicy(option.value as typeof joinPolicy)}
                  className={`w-full p-3 rounded-lg text-left transition-all flex items-center justify-between ${
                    joinPolicy === option.value
                      ? 'bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-500'
                      : 'bg-dark-50 dark:bg-dark-700/50 border-2 border-transparent'
                  }`}
                >
                  <div>
                    <span className="font-medium text-dark-900 dark:text-white">
                      {option.label}
                    </span>
                    <p className="text-xs text-dark-500">{option.desc}</p>
                  </div>
                  {joinPolicy === option.value && (
                    <div className="w-2 h-2 rounded-full bg-primary-500" />
                  )}
                </button>
              ))}
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
