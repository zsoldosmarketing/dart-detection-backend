import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users,
  Trophy,
  MessageSquare,
  Settings,
  UserPlus,
  LogOut,
  Crown,
  Shield,
  User,
  Send,
  MoreVertical,
  ArrowLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import clsx from 'clsx';

interface Club {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  join_policy: string;
  total_members: number;
  total_games: number;
  total_wins: number;
  average_skill: number;
  created_by: string;
}

interface ClubMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  games_played: number;
  games_won: number;
  joined_at: string;
  user_profile: {
    display_name: string | null;
    avatar_url: string | null;
    skill_rating: number;
  } | null;
}

interface FeedPost {
  id: string;
  user_id: string;
  post_type: string;
  content: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  user_profile: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export function ClubDetailPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [membership, setMembership] = useState<ClubMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'feed' | 'members' | 'stats'>('feed');
  const [newPost, setNewPost] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    if (clubId) {
      fetchClubData();
    }
  }, [clubId, user]);

  const fetchClubData = async () => {
    if (!clubId) return;

    setIsLoading(true);

    const { data: clubData } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', clubId)
      .maybeSingle();

    if (clubData) {
      setClub(clubData);

      const { data: membersData } = await supabase
        .from('club_members')
        .select(`
          *,
          user_profile:user_id (
            display_name,
            avatar_url,
            skill_rating
          )
        `)
        .eq('club_id', clubId)
        .eq('status', 'active')
        .order('role', { ascending: true });

      setMembers(membersData || []);

      if (user) {
        const userMember = membersData?.find(m => m.user_id === user.id);
        setMembership(userMember || null);
      }

      if (membersData?.some(m => m.user_id === user?.id)) {
        const { data: postsData } = await supabase
          .from('club_feed_posts')
          .select(`
            *,
            user_profile:user_id (
              display_name,
              avatar_url
            )
          `)
          .eq('club_id', clubId)
          .order('created_at', { ascending: false })
          .limit(20);

        setPosts(postsData || []);
      }
    }

    setIsLoading(false);
  };

  const handleJoinClub = async () => {
    if (!user || !club) return;

    const status = club.join_policy === 'open' ? 'active' : 'pending';

    const { error } = await supabase.from('club_members').insert({
      club_id: club.id,
      user_id: user.id,
      role: 'member',
      status,
    });

    if (!error) {
      fetchClubData();
    }
  };

  const handleLeaveClub = async () => {
    if (!user || !clubId || !membership) return;

    const { error } = await supabase
      .from('club_members')
      .delete()
      .eq('id', membership.id);

    if (!error) {
      setMembership(null);
      fetchClubData();
    }
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !clubId || !newPost.trim()) return;

    setIsPosting(true);

    const { error } = await supabase.from('club_feed_posts').insert({
      club_id: clubId,
      user_id: user.id,
      post_type: 'text',
      content: newPost.trim(),
    });

    if (!error) {
      setNewPost('');
      fetchClubData();
    }

    setIsPosting(false);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4 text-warning-500" />;
      case 'officer': return <Shield className="w-4 h-4 text-primary-500" />;
      default: return <User className="w-4 h-4 text-dark-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!club) {
    return (
      <Card className="p-8 text-center">
        <Users className="w-12 h-12 text-dark-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">
          Klub nem talalhato
        </h3>
        <Button variant="outline" onClick={() => navigate('/clubs')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Vissza a klubokhoz
        </Button>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-6">
      <button
        onClick={() => navigate('/clubs')}
        className="flex items-center gap-2 text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Vissza
      </button>

      <Card className="overflow-hidden">
        {club.banner_url && (
          <div className="h-32 bg-gradient-to-r from-primary-500 to-secondary-500">
            <img src={club.banner_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        {!club.banner_url && (
          <div className="h-32 bg-gradient-to-r from-primary-500 to-secondary-500" />
        )}

        <div className="p-6 -mt-12 relative">
          <div className="flex items-end gap-4">
            <div className="w-24 h-24 rounded-xl bg-white dark:bg-dark-800 border-4 border-white dark:border-dark-800 shadow-lg flex items-center justify-center">
              {club.avatar_url ? (
                <img src={club.avatar_url} alt="" className="w-full h-full rounded-lg object-cover" />
              ) : (
                <Users className="w-10 h-10 text-dark-400" />
              )}
            </div>
            <div className="flex-1 pb-2">
              <h1 className="text-2xl font-bold text-dark-900 dark:text-white">{club.name}</h1>
              <div className="flex items-center gap-4 text-sm text-dark-500">
                <span>{club.total_members} tag</span>
                <span>{club.total_games} játék</span>
              </div>
            </div>
            <div>
              {membership ? (
                <div className="flex items-center gap-2">
                  <Badge variant="success">Tag</Badge>
                  {membership.role !== 'owner' && (
                    <Button variant="outline" size="sm" onClick={handleLeaveClub}>
                      <LogOut className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ) : (
                <Button onClick={handleJoinClub}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Csatlakozas
                </Button>
              )}
            </div>
          </div>

          {club.description && (
            <p className="mt-4 text-dark-600 dark:text-dark-400">{club.description}</p>
          )}
        </div>
      </Card>

      <div className="flex gap-2 border-b border-dark-200 dark:border-dark-700">
        {(['feed', 'members', 'stats'] as const).map((tab) => (
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
            {tab === 'feed' && 'Fal'}
            {tab === 'members' && 'Tagok'}
            {tab === 'stats' && 'Statisztikak'}
          </button>
        ))}
      </div>

      {activeTab === 'feed' && (
        <div className="space-y-4">
          {membership && (
            <Card className="p-4">
              <form onSubmit={handlePostSubmit}>
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="Irj valamit a klubnak..."
                  className="w-full p-3 bg-dark-50 dark:bg-dark-700 rounded-lg border border-dark-200 dark:border-dark-600 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                />
                <div className="flex justify-end mt-3">
                  <Button type="submit" size="sm" disabled={!newPost.trim()} isLoading={isPosting}>
                    <Send className="w-4 h-4 mr-2" />
                    Küldés
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {!membership && (
            <Card className="p-8 text-center">
              <MessageSquare className="w-12 h-12 text-dark-400 mx-auto mb-4" />
              <p className="text-dark-500">
                Csatlakozz a klubhoz, hogy lasd a falat!
              </p>
            </Card>
          )}

          {membership && posts.length === 0 && (
            <Card className="p-8 text-center">
              <MessageSquare className="w-12 h-12 text-dark-400 mx-auto mb-4" />
              <p className="text-dark-500">
                Meg nincsenek bejegyzesek. Irj elsonek!
              </p>
            </Card>
          )}

          {posts.map((post) => (
            <Card key={post.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center text-white font-semibold">
                  {post.user_profile?.display_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-dark-900 dark:text-white">
                      {post.user_profile?.display_name || 'Ismeretlen'}
                    </span>
                    <span className="text-xs text-dark-400">
                      {format(new Date(post.created_at), 'MMM d, HH:mm', { locale: hu })}
                    </span>
                  </div>
                  <p className="mt-1 text-dark-600 dark:text-dark-400">{post.content}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'members' && (
        <div className="space-y-2">
          {members.map((member) => (
            <Card key={member.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center text-white font-semibold">
                    {member.user_profile?.display_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-dark-900 dark:text-white">
                        {member.user_profile?.display_name || 'Ismeretlen'}
                      </span>
                      {getRoleIcon(member.role)}
                    </div>
                    <p className="text-sm text-dark-500">
                      {member.games_played} játék | {member.games_won} győzelem
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-dark-900 dark:text-white">
                    {member.user_profile?.skill_rating?.toFixed(1) || '5.0'}
                  </p>
                  <p className="text-xs text-dark-400">Skill</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
              Klub statisztikák
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-dark-500">Összes tag</span>
                <span className="font-semibold text-dark-900 dark:text-white">{club.total_members}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-500">Összes játék</span>
                <span className="font-semibold text-dark-900 dark:text-white">{club.total_games}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-500">Összes győzelem</span>
                <span className="font-semibold text-dark-900 dark:text-white">{club.total_wins}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-500">Átlagos skill</span>
                <span className="font-semibold text-dark-900 dark:text-white">
                  {club.average_skill?.toFixed(1) || '0'}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
              Top játékosok
            </h3>
            <div className="space-y-3">
              {members
                .sort((a, b) => b.games_won - a.games_won)
                .slice(0, 5)
                .map((member, index) => (
                  <div key={member.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={clsx(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                        index === 0 && 'bg-warning-500 text-white',
                        index === 1 && 'bg-dark-300 text-dark-700',
                        index === 2 && 'bg-amber-600 text-white',
                        index > 2 && 'bg-dark-100 dark:bg-dark-700 text-dark-500'
                      )}>
                        {index + 1}
                      </span>
                      <span className="text-dark-700 dark:text-dark-300">
                        {member.user_profile?.display_name || 'Ismeretlen'}
                      </span>
                    </div>
                    <span className="font-semibold text-dark-900 dark:text-white">
                      {member.games_won} gy
                    </span>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
