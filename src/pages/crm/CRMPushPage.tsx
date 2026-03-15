import { useState, useEffect } from 'react';
import { Bell, Send, Plus, Users, Clock, CheckCircle, XCircle, CreditCard as Edit, Trash2, Eye, Filter, Search, Calendar, Target, ChevronDown, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';

interface Campaign {
  id: string;
  title: string;
  body: string;
  category: string;
  target_audience: string;
  scheduled_at: string | null;
  sent_at: string | null;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  total_recipients: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  created_at: string;
}

type Tab = 'all' | 'draft' | 'scheduled' | 'sent';

export function CRMPushPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setIsLoading(true);

    const mockCampaigns: Campaign[] = [
      {
        id: '1',
        title: 'Új kihívás elérhető!',
        body: 'Próbáld ki az új heti kihívást és nyerj extra tokeneket!',
        category: 'game',
        target_audience: 'all_users',
        scheduled_at: null,
        sent_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'sent',
        total_recipients: 1250,
        delivered_count: 1198,
        opened_count: 456,
        clicked_count: 123,
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '2',
        title: 'Premium akciok',
        body: '50% kedvezmeny a premium elofizetesre, csak ma!',
        category: 'admin',
        target_audience: 'free_users',
        scheduled_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        sent_at: null,
        status: 'scheduled',
        total_recipients: 890,
        delivered_count: 0,
        opened_count: 0,
        clicked_count: 0,
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '3',
        title: 'Torna emlekeztetok',
        body: 'Ne feledd, holnap kezdodik a havi nagy torna!',
        category: 'tournament',
        target_audience: 'tournament_participants',
        scheduled_at: null,
        sent_at: null,
        status: 'draft',
        total_recipients: 0,
        delivered_count: 0,
        opened_count: 0,
        clicked_count: 0,
        created_at: new Date().toISOString(),
      },
      {
        id: '4',
        title: 'Üdvözlünk új tagunk!',
        body: 'Köszönjük, hogy csatlakoztál! Kezdd el az edzést most!',
        category: 'system',
        target_audience: 'new_users',
        scheduled_at: null,
        sent_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'sent',
        total_recipients: 320,
        delivered_count: 318,
        opened_count: 289,
        clicked_count: 156,
        created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    setCampaigns(mockCampaigns);
    setIsLoading(false);
  };

  const getStatusBadge = (status: Campaign['status']) => {
    switch (status) {
      case 'draft':
        return <Badge variant="default">Piszkózat</Badge>;
      case 'scheduled':
        return <Badge variant="warning">Ütemezve</Badge>;
      case 'sending':
        return <Badge variant="primary">Küldés...</Badge>;
      case 'sent':
        return <Badge variant="success">Elküldve</Badge>;
      case 'failed':
        return <Badge variant="error">Sikertelen</Badge>;
    }
  };

  const getAudienceLabel = (audience: string) => {
    switch (audience) {
      case 'all_users':
        return 'Minden felhasználó';
      case 'free_users':
        return 'Ingyenes felhasználók';
      case 'premium_users':
        return 'Premium felhasználók';
      case 'new_users':
        return 'Új felhasználók';
      case 'inactive_users':
        return 'Inaktív felhasználók';
      case 'tournament_participants':
        return 'Torna résztvevők';
      default:
        return audience;
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    if (activeTab !== 'all' && c.status !== activeTab) return false;
    if (
      searchQuery &&
      !c.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !c.body.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const stats = {
    total: campaigns.length,
    draft: campaigns.filter((c) => c.status === 'draft').length,
    scheduled: campaigns.filter((c) => c.status === 'scheduled').length,
    sent: campaigns.filter((c) => c.status === 'sent').length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">
            Push Kampányok
          </h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            Push értesítések kezelése és küldése
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setShowCreateModal(true)}
        >
          Új kampány
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <Bell className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-dark-500">Összes</p>
              <p className="text-xl font-bold text-dark-900 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-dark-100 dark:bg-dark-700 rounded-lg">
              <Edit className="w-5 h-5 text-dark-500" />
            </div>
            <div>
              <p className="text-sm text-dark-500">Piszkózat</p>
              <p className="text-xl font-bold text-dark-900 dark:text-white">{stats.draft}</p>
            </div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-dark-500">Ütemezve</p>
              <p className="text-xl font-bold text-dark-900 dark:text-white">{stats.scheduled}</p>
            </div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-dark-500">Elküldve</p>
              <p className="text-xl font-bold text-dark-900 dark:text-white">{stats.sent}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
          <div className="flex gap-2">
            {(['all', 'draft', 'scheduled', 'sent'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-700'
                }`}
              >
                {tab === 'all' && 'Mind'}
                {tab === 'draft' && 'Piszkózat'}
                {tab === 'scheduled' && 'Ütemezve'}
                {tab === 'sent' && 'Elküldve'}
              </button>
            ))}
          </div>

          <div className="flex-1">
            <Input
              placeholder="Keresés..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>

        {filteredCampaigns.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-dark-400 mx-auto mb-4" />
            <p className="text-dark-500 dark:text-dark-400">Nincs talalat</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCampaigns.map((campaign) => (
              <CampaignRow
                key={campaign.id}
                campaign={campaign}
                onEdit={() => setEditingCampaign(campaign)}
                getStatusBadge={getStatusBadge}
                getAudienceLabel={getAudienceLabel}
              />
            ))}
          </div>
        )}
      </Card>

      {showCreateModal && (
        <CreateCampaignModal
          onClose={() => setShowCreateModal(false)}
          onSave={async (data) => {
            setShowCreateModal(false);
            await fetchCampaigns();
          }}
        />
      )}

      {editingCampaign && (
        <CreateCampaignModal
          campaign={editingCampaign}
          onClose={() => setEditingCampaign(null)}
          onSave={async (data) => {
            setEditingCampaign(null);
            await fetchCampaigns();
          }}
        />
      )}
    </div>
  );
}

interface CampaignRowProps {
  campaign: Campaign;
  onEdit: () => void;
  getStatusBadge: (status: Campaign['status']) => JSX.Element;
  getAudienceLabel: (audience: string) => string;
}

function CampaignRow({ campaign, onEdit, getStatusBadge, getAudienceLabel }: CampaignRowProps) {
  const [expanded, setExpanded] = useState(false);

  const deliveryRate = campaign.total_recipients > 0
    ? Math.round((campaign.delivered_count / campaign.total_recipients) * 100)
    : 0;
  const openRate = campaign.delivered_count > 0
    ? Math.round((campaign.opened_count / campaign.delivered_count) * 100)
    : 0;
  const clickRate = campaign.opened_count > 0
    ? Math.round((campaign.clicked_count / campaign.opened_count) * 100)
    : 0;

  return (
    <div className="border border-dark-200 dark:border-dark-700 rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-dark-50 dark:hover:bg-dark-800 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="p-2 bg-dark-100 dark:bg-dark-700 rounded-lg">
            <Bell className="w-5 h-5 text-dark-500" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-dark-900 dark:text-white truncate">
                {campaign.title}
              </h3>
              {getStatusBadge(campaign.status)}
            </div>
            <p className="text-sm text-dark-500 truncate">{campaign.body}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-sm text-dark-500">
            <Users className="w-4 h-4" />
            {campaign.total_recipients || '-'}
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-dark-500">
            <Calendar className="w-4 h-4" />
            {format(new Date(campaign.created_at), 'MMM d', { locale: hu })}
          </div>
          <ChevronDown
            className={`w-5 h-5 text-dark-400 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-dark-200 dark:border-dark-700 p-4 bg-dark-50 dark:bg-dark-800/50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-dark-500 mb-1">Célcsoport</p>
              <p className="text-sm font-medium text-dark-900 dark:text-white">
                {getAudienceLabel(campaign.target_audience)}
              </p>
            </div>
            <div>
              <p className="text-xs text-dark-500 mb-1">Kategória</p>
              <Badge variant="secondary">{campaign.category}</Badge>
            </div>
            {campaign.scheduled_at && (
              <div>
                <p className="text-xs text-dark-500 mb-1">Ütemezve</p>
                <p className="text-sm font-medium text-dark-900 dark:text-white">
                  {format(new Date(campaign.scheduled_at), 'yyyy.MM.dd HH:mm', { locale: hu })}
                </p>
              </div>
            )}
            {campaign.sent_at && (
              <div>
                <p className="text-xs text-dark-500 mb-1">Elküldve</p>
                <p className="text-sm font-medium text-dark-900 dark:text-white">
                  {format(new Date(campaign.sent_at), 'yyyy.MM.dd HH:mm', { locale: hu })}
                </p>
              </div>
            )}
          </div>

          {campaign.status === 'sent' && (
            <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-white dark:bg-dark-900 rounded-lg">
              <div className="text-center">
                <p className="text-2xl font-bold text-dark-900 dark:text-white">{deliveryRate}%</p>
                <p className="text-xs text-dark-500">Kezbesites</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary-600">{openRate}%</p>
                <p className="text-xs text-dark-500">Megnyitas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{clickRate}%</p>
                <p className="text-xs text-dark-500">Attklikkeles</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {campaign.status === 'draft' && (
              <>
                <Button variant="primary" size="sm" leftIcon={<Send className="w-4 h-4" />}>
                  Küldés
                </Button>
                <Button variant="outline" size="sm" leftIcon={<Clock className="w-4 h-4" />}>
                  Ütemez
                </Button>
              </>
            )}
            {campaign.status === 'scheduled' && (
              <Button variant="outline" size="sm" leftIcon={<XCircle className="w-4 h-4" />}>
                Mégse
              </Button>
            )}
            <Button variant="ghost" size="sm" leftIcon={<Edit className="w-4 h-4" />} onClick={onEdit}>
              Szerkesztés
            </Button>
            <Button variant="ghost" size="sm" leftIcon={<Eye className="w-4 h-4" />}>
              Részletek
            </Button>
            {campaign.status === 'draft' && (
              <Button variant="ghost" size="sm" leftIcon={<Trash2 className="w-4 h-4 text-red-500" />}>
                Törlés
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface CreateCampaignModalProps {
  campaign?: Campaign;
  onClose: () => void;
  onSave: (data: Partial<Campaign>) => Promise<void>;
}

function CreateCampaignModal({ campaign, onClose, onSave }: CreateCampaignModalProps) {
  const [title, setTitle] = useState(campaign?.title || '');
  const [body, setBody] = useState(campaign?.body || '');
  const [category, setCategory] = useState(campaign?.category || 'system');
  const [audience, setAudience] = useState(campaign?.target_audience || 'all_users');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave({ title, body, category, target_audience: audience });
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <Card className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-6">
          {campaign ? 'Kampány szerkesztése' : 'Új kampány'}
        </h2>

        <div className="space-y-4">
          <Input
            label="Cím"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Értesítés címe"
          />

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Üzenet
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Értesítés szövege..."
              rows={3}
              className="w-full px-4 py-2 bg-white dark:bg-dark-800 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Kategória
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-dark-800 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            >
              <option value="system">Rendszer</option>
              <option value="game">Játék</option>
              <option value="tournament">Torna</option>
              <option value="club">Klub</option>
              <option value="admin">Admin</option>
              <option value="nudge">Emlékeztetők</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Célcsoport
            </label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-dark-800 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            >
              <option value="all_users">Minden felhasználó</option>
              <option value="free_users">Ingyenes felhasználók</option>
              <option value="premium_users">Premium felhasználók</option>
              <option value="new_users">Új felhasználók (7 napon belül)</option>
              <option value="inactive_users">Inaktív felhasználók</option>
              <option value="tournament_participants">Torna résztvevők</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Mégse
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleSave}
            isLoading={isSaving}
          >
            Mentés
          </Button>
        </div>
      </Card>
    </div>
  );
}
