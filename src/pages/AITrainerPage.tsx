import { useState, useEffect } from 'react';
import { Sparkles, MessageSquare, Target, Lightbulb, Dumbbell, TrendingUp, ChevronRight, History } from 'lucide-react';
import { AIChatPanel } from '../components/ai/AIChatPanel';
import { AIGoalsPanel } from '../components/ai/AIGoalsPanel';
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

const TABS: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Edző Chat', icon: MessageSquare },
  { id: 'goals', label: 'Céljaim', icon: Target },
  { id: 'plans', label: 'Edzésterv', icon: Dumbbell },
  { id: 'insights', label: 'Elemzések', icon: Lightbulb },
];

export function AITrainerPage() {
  const { user, profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  useEffect(() => {
    if (user) {
      fetchConversations();
      fetchStats();
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

  const handleConversationCreated = (id: string) => {
    setConversationId(id);
    fetchConversations();
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

  const displayName = profile?.display_name || profile?.username || 'Játékos';

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] md:h-[calc(100vh-2rem)] max-h-[900px] animate-fade-in">
      <div className="flex items-start justify-between gap-4 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
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
              Személyes edződ · {displayName}
            </p>
          </div>
        </div>

        {playerStats && (
          <div className="hidden sm:flex items-center gap-4 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-xl px-4 py-2.5">
            <div className="text-center">
              <p className="text-xs text-dark-400">Átlag</p>
              <p className="text-sm font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {playerStats.lifetime_average?.toFixed(1) || '—'}
              </p>
            </div>
            <div className="w-px h-8 bg-dark-200 dark:bg-dark-700" />
            <div className="text-center">
              <p className="text-xs text-dark-400">Győzelmi %</p>
              <p className="text-sm font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {playerStats.lifetime_win_percentage?.toFixed(0) || '—'}%
              </p>
            </div>
            <div className="w-px h-8 bg-dark-200 dark:bg-dark-700" />
            <div className="text-center">
              <p className="text-xs text-dark-400">Kiszálló %</p>
              <p className="text-sm font-bold text-dark-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {playerStats.lifetime_checkout_percentage?.toFixed(0) || '—'}%
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-dark-100 dark:bg-dark-800 rounded-xl mb-4 shrink-0 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center',
                activeTab === tab.id
                  ? 'bg-white dark:bg-dark-700 text-dark-900 dark:text-white shadow-sm'
                  : 'text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-300'
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 flex gap-4">
        {activeTab === 'chat' && (
          <>
            <div className="hidden lg:flex flex-col w-64 shrink-0 gap-4 overflow-y-auto">
              <div className="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-dark-700 dark:text-dark-300 flex items-center gap-1.5">
                    <History className="w-4 h-4" />
                    Korábbi chatok
                  </h3>
                  <button
                    onClick={() => { setConversationId(null); fetchConversations(); }}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    + Új
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
                          'w-full text-left px-2 py-2 rounded-lg text-xs transition-colors group',
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

              <div className="bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl p-4">
                <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 mb-2">Gyors elemzések</p>
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
                      <Dumbbell className="w-3.5 h-3.5 text-secondary-500" />
                      Edzésterv generálás
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-dark-400" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-xl overflow-hidden flex flex-col">
              <AIChatPanel
                conversationId={conversationId}
                onConversationCreated={handleConversationCreated}
              />
            </div>
          </>
        )}

        {activeTab === 'goals' && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-lg mx-auto">
              <AIGoalsPanel />
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
            <div className="max-w-lg mx-auto">
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
