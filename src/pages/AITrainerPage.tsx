import { useState, useEffect } from 'react';
import {
  Sparkles, MessageSquare, Target, Lightbulb, Dumbbell,
  TrendingUp, ChevronRight, History, Plus, Bot, Zap, RefreshCw
} from 'lucide-react';
import { AIChatPanel } from '../components/ai/AIChatPanel';
import { AIInsightsPanel } from '../components/ai/AIInsightsPanel';
import { AITrainingPlanPanel } from '../components/ai/AITrainingPlanPanel';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import clsx from 'clsx';

type Tab = 'chat' | 'goals' | 'plans' | 'insights';

interface Conversation {
  id: string;
  title: string;
  last_message_at: string;
}

interface PlayerStats {
  lifetime_average?: number;
  lifetime_win_percentage?: number;
  lifetime_checkout_percentage?: number;
  first_nine_average?: number;
}

interface Goal {
  id: string;
  title: string;
  goal_type: string;
  target_value: number;
  current_value: number;
  unit: string;
  deadline: string | null;
  status: string;
  ai_generated?: boolean;
}

const TABS: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Edző Chat', icon: MessageSquare },
  { id: 'goals', label: 'Céljaim', icon: Target },
  { id: 'plans', label: 'Edzésterv', icon: Dumbbell },
  { id: 'insights', label: 'Elemzések', icon: Lightbulb },
];

const GOAL_TYPE_COLORS: Record<string, string> = {
  average: 'from-blue-500 to-blue-600',
  checkout: 'from-emerald-500 to-emerald-600',
  wins: 'from-amber-500 to-amber-600',
  streak: 'from-rose-500 to-rose-600',
  custom: 'from-teal-500 to-teal-600',
};

const GOAL_TYPE_BG: Record<string, string> = {
  average: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  checkout: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  wins: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  streak: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',
  custom: 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800',
};

export function AITrainerPage() {
  const { user, profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [goalRefreshKey, setGoalRefreshKey] = useState(0);

  useEffect(() => {
    if (user) {
      fetchConversations();
      fetchStats();
      fetchGoals();
    }
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ai_conversations')
      .select('id, title, last_message_at')
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false })
      .limit(10);
    if (data) setConversations(data as Conversation[]);
  };

  const fetchStats = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('player_statistics_summary')
      .select('lifetime_average, lifetime_win_percentage, lifetime_checkout_percentage, first_nine_average')
      .eq('player_id', user.id)
      .maybeSingle();
    if (data) setPlayerStats(data);
  };

  const fetchGoals = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ai_goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (data) setGoals(data as Goal[]);
  };

  const handleConversationCreated = (id: string) => {
    setConversationId(id);
    fetchConversations();
    setTimeout(fetchGoals, 3000);
  };

  const handleRequestAnalysis = async () => {
    setIsAnalyzing(true);
    setActiveTab('chat');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/groq-ai`;
      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'analyze', conversation_id: conversationId }),
      });
      fetchConversations();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRequestPlan = async () => {
    setIsGeneratingPlan(true);
    setActiveTab('chat');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/groq-ai`;
      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'generate_plan', conversation_id: conversationId }),
      });
      fetchConversations();
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleGoalComplete = async (id: string) => {
    await supabase.from('ai_goals').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', id);
    setGoals(prev => prev.filter(g => g.id !== id));
  };

  const handleGoalDelete = async (id: string) => {
    await supabase.from('ai_goals').delete().eq('id', id);
    setGoals(prev => prev.filter(g => g.id !== id));
  };

  const displayName = profile?.display_name || profile?.username || 'Játékos';

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] md:h-[calc(100vh-2rem)] max-h-[900px] animate-fade-in">
      <div className="flex items-start justify-between gap-4 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-success-500 rounded-full flex items-center justify-center shadow-sm border-2 border-white dark:border-dark-950">
              <span className="text-white text-[8px] font-bold">AI</span>
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold text-dark-900 dark:text-white leading-tight">
              DartsCoach AI
            </h1>
            <p className="text-xs text-dark-500 dark:text-dark-400">
              Autonóm személyes edző · {displayName}
            </p>
          </div>
        </div>

        {playerStats && (
          <div className="hidden sm:flex items-center gap-4 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-xl px-4 py-2.5 shadow-sm">
            <div className="text-center">
              <p className="text-[10px] text-dark-400 uppercase tracking-wide">Átlag</p>
              <p className="text-sm font-bold text-dark-900 dark:text-white tabular-nums">
                {playerStats.lifetime_average?.toFixed(1) || '—'}
              </p>
            </div>
            <div className="w-px h-8 bg-dark-200 dark:bg-dark-700" />
            <div className="text-center">
              <p className="text-[10px] text-dark-400 uppercase tracking-wide">Győzelmi %</p>
              <p className="text-sm font-bold text-dark-900 dark:text-white tabular-nums">
                {playerStats.lifetime_win_percentage?.toFixed(0) || '—'}%
              </p>
            </div>
            <div className="w-px h-8 bg-dark-200 dark:bg-dark-700" />
            <div className="text-center">
              <p className="text-[10px] text-dark-400 uppercase tracking-wide">Kiszálló %</p>
              <p className="text-sm font-bold text-dark-900 dark:text-white tabular-nums">
                {playerStats.lifetime_checkout_percentage?.toFixed(0) || '—'}%
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-dark-100 dark:bg-dark-800 rounded-xl mb-4 shrink-0 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isGoalTab = tab.id === 'goals';
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center relative',
                activeTab === tab.id
                  ? 'bg-white dark:bg-dark-700 text-dark-900 dark:text-white shadow-sm'
                  : 'text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-300'
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {isGoalTab && goals.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {goals.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 flex gap-4">
        {activeTab === 'chat' && (
          <>
            <div className="hidden lg:flex flex-col w-64 shrink-0 gap-3 overflow-y-auto">
              <div className="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-dark-600 dark:text-dark-400 uppercase tracking-wide flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Előzmények
                  </h3>
                  <button
                    onClick={() => { setConversationId(null); fetchConversations(); }}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Új
                  </button>
                </div>
                {conversations.length === 0 ? (
                  <p className="text-xs text-dark-400 text-center py-3">Még nincs chat előzmény</p>
                ) : (
                  <div className="space-y-1">
                    {conversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => setConversationId(conv.id)}
                        className={clsx(
                          'w-full text-left px-2 py-2 rounded-lg text-xs transition-colors',
                          conversationId === conv.id
                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                            : 'text-dark-600 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-700/50'
                        )}
                      >
                        <p className="font-medium truncate">{conv.title}</p>
                        <p className="text-dark-400 text-[10px] mt-0.5">
                          {format(new Date(conv.last_message_at), 'MMM d. HH:mm', { locale: hu })}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/20 dark:to-primary-900/10 border border-primary-200 dark:border-primary-800 rounded-xl p-4">
                <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 mb-3 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  Gyors elemzések
                </p>
                <div className="space-y-2">
                  <button
                    onClick={handleRequestAnalysis}
                    disabled={isAnalyzing}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white dark:bg-dark-800 border border-primary-200 dark:border-primary-700 hover:border-primary-400 transition-colors text-xs font-medium text-dark-700 dark:text-dark-300 disabled:opacity-50"
                  >
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-primary-500" />
                      Teljesítményelemzés
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-dark-400" />
                  </button>
                  <button
                    onClick={handleRequestPlan}
                    disabled={isGeneratingPlan}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white dark:bg-dark-800 border border-primary-200 dark:border-primary-700 hover:border-primary-400 transition-colors text-xs font-medium text-dark-700 dark:text-dark-300 disabled:opacity-50"
                  >
                    <span className="flex items-center gap-1.5">
                      <Dumbbell className="w-3.5 h-3.5 text-primary-500" />
                      Edzésterv generálás
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-dark-400" />
                  </button>
                </div>
              </div>

              {goals.length > 0 && (
                <div className="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-dark-600 dark:text-dark-400 uppercase tracking-wide flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5" />
                      Aktív célok
                    </p>
                    <button
                      onClick={() => setActiveTab('goals')}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Összes
                    </button>
                  </div>
                  <div className="space-y-2">
                    {goals.slice(0, 3).map(goal => {
                      const pct = goal.target_value > 0
                        ? Math.min((goal.current_value / goal.target_value) * 100, 100)
                        : 0;
                      return (
                        <div key={goal.id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-dark-700 dark:text-dark-300 truncate flex-1">{goal.title}</p>
                            {goal.ai_generated && (
                              <span className="text-[9px] text-primary-500 font-medium ml-1 shrink-0">AI</span>
                            )}
                          </div>
                          <div className="h-1.5 bg-dark-100 dark:bg-dark-700 rounded-full overflow-hidden">
                            <div
                              className={clsx('h-full rounded-full bg-gradient-to-r', GOAL_TYPE_COLORS[goal.goal_type] || 'from-primary-500 to-primary-600')}
                              style={{ width: `${pct}%`, transition: 'width 0.7s ease' }}
                            />
                          </div>
                          <p className="text-[10px] text-dark-400">{pct.toFixed(0)}% · {goal.current_value}/{goal.target_value} {goal.unit}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-xl overflow-hidden flex flex-col shadow-sm">
              <AIChatPanel
                conversationId={conversationId}
                onConversationCreated={handleConversationCreated}
              />
            </div>
          </>
        )}

        {activeTab === 'goals' && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-dark-900 dark:text-white">Céljaim</h3>
                  <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5 flex items-center gap-1">
                    <Bot className="w-3 h-3" />
                    Az AI automatikusan generálja a célokat a chat alapján
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchGoals}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-dark-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                    title="Frissítés"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveTab('chat')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Új cél chatben
                  </button>
                </div>
              </div>

              {goals.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-2xl">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/40 dark:to-primary-800/40 flex items-center justify-center mx-auto mb-4">
                    <Target className="w-8 h-8 text-primary-500" />
                  </div>
                  <h4 className="text-base font-semibold text-dark-800 dark:text-white mb-2">Még nincsenek célok</h4>
                  <p className="text-sm text-dark-500 dark:text-dark-400 mb-6 max-w-xs mx-auto leading-relaxed">
                    Mondj az AI edzőnek hogy mire szeretnél törekedni, és ő automatikusan létrehozza és nyomon követi a célodat.
                  </p>
                  <button
                    onClick={() => setActiveTab('chat')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors shadow-md shadow-primary-500/30"
                  >
                    <Sparkles className="w-4 h-4" />
                    Beszélj az AI edzővel
                  </button>
                  <p className="text-xs text-dark-400 mt-4 italic">Pl.: "Szeretnék 65-ös átlagot elérni" · "Célom 5 meccset nyerni"</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {goals.map((goal) => {
                    const pct = goal.target_value > 0
                      ? Math.min((goal.current_value / goal.target_value) * 100, 100)
                      : 0;
                    return (
                      <div
                        key={goal.id}
                        className={clsx(
                          'p-5 rounded-2xl border transition-shadow hover:shadow-md',
                          GOAL_TYPE_BG[goal.goal_type] || GOAL_TYPE_BG.custom
                        )}
                      >
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-dark-900 dark:text-white text-sm">{goal.title}</h4>
                              {goal.ai_generated && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-[10px] font-semibold">
                                  <Bot className="w-2.5 h-2.5" />
                                  AI
                                </span>
                              )}
                            </div>
                            {goal.deadline && (
                              <p className="text-xs text-dark-500 dark:text-dark-400">
                                Határidő: {format(new Date(goal.deadline), 'yyyy. MMM d.', { locale: hu })}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleGoalComplete(goal.id)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-success-700 dark:text-success-400 bg-success-50 dark:bg-success-900/20 hover:bg-success-100 transition-colors"
                            >
                              Kész
                            </button>
                            <button
                              onClick={() => handleGoalDelete(goal.id)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-dark-500 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                            >
                              Törlés
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-dark-600 dark:text-dark-400 font-medium">
                              {goal.current_value} / {goal.target_value} {goal.unit}
                            </span>
                            <span className="font-bold text-dark-800 dark:text-dark-200 text-base">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                          <div className="h-3 bg-white/60 dark:bg-dark-900/40 rounded-full overflow-hidden shadow-inner">
                            <div
                              className={clsx(
                                'h-full rounded-full bg-gradient-to-r transition-all duration-700 shadow-sm',
                                GOAL_TYPE_COLORS[goal.goal_type] || 'from-primary-500 to-primary-600'
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="p-4 bg-gradient-to-r from-primary-50 to-primary-100/50 dark:from-primary-900/20 dark:to-primary-900/10 border border-primary-200 dark:border-primary-800 rounded-xl">
                <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Hogyan működnek az AI célok?
                </p>
                <p className="text-xs text-primary-600/80 dark:text-primary-400/80 leading-relaxed">
                  Ha a chatben megemlíted hogy mire törekedel (pl. "65-ös átlagot szeretnék"), az AI automatikusan létrehozza a célt és nyomon követi a fejlődésedet a meccsei és edzések alapján.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'plans' && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-2xl mx-auto">
              <AITrainingPlanPanel
                onRequestPlan={handleRequestPlan}
                isGenerating={isGeneratingPlan}
              />
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-2xl mx-auto">
              <AIInsightsPanel
                onRequestAnalysis={handleRequestAnalysis}
                isAnalyzing={isAnalyzing}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
