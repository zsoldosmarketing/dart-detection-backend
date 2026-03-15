import { useState, useEffect } from 'react';
import { Lightbulb, TrendingUp, AlertTriangle, Star, Info, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import clsx from 'clsx';

interface Insight {
  id: string;
  insight_type: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

const INSIGHT_STYLES: Record<string, { icon: typeof Lightbulb; color: string; bg: string; border: string }> = {
  performance: {
    icon: TrendingUp,
    color: 'text-primary-600',
    bg: 'bg-primary-50 dark:bg-primary-900/20',
    border: 'border-primary-200 dark:border-primary-800',
  },
  recommendation: {
    icon: Lightbulb,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
  },
  milestone: {
    icon: Star,
    color: 'text-success-600',
    bg: 'bg-success-50 dark:bg-success-900/20',
    border: 'border-success-200 dark:border-success-800',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-error-600',
    bg: 'bg-error-50 dark:bg-error-900/20',
    border: 'border-error-200 dark:border-error-800',
  },
  tip: {
    icon: Info,
    color: 'text-secondary-600',
    bg: 'bg-secondary-50 dark:bg-secondary-900/20',
    border: 'border-secondary-200 dark:border-secondary-800',
  },
};

interface AIInsightsPanelProps {
  onRequestAnalysis: () => void;
  isAnalyzing: boolean;
}

export function AIInsightsPanel({ onRequestAnalysis, isAnalyzing }: AIInsightsPanelProps) {
  const { user } = useAuthStore();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) fetchInsights();
  }, [user]);

  const fetchInsights = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setInsights(data as Insight[]);
    setIsLoading(false);
  };

  const markRead = async (id: string) => {
    await supabase.from('ai_insights').update({ is_read: true }).eq('id', id);
    setInsights(prev => prev.map(i => i.id === id ? { ...i, is_read: true } : i));
  };

  const deleteInsight = async (id: string) => {
    await supabase.from('ai_insights').delete().eq('id', id);
    setInsights(prev => prev.filter(i => i.id !== id));
  };

  const unreadCount = insights.filter(i => !i.is_read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-dark-900 dark:text-white">AI Elemzések</h3>
          {unreadCount > 0 && (
            <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">
              {unreadCount} olvasatlan
            </p>
          )}
        </div>
        <button
          onClick={onRequestAnalysis}
          disabled={isAnalyzing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors text-xs font-medium disabled:opacity-50"
        >
          {isAnalyzing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Elemzés kérése
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-dark-100 dark:bg-dark-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : insights.length === 0 ? (
        <div className="text-center py-10">
          <Lightbulb className="w-10 h-10 text-dark-300 dark:text-dark-600 mx-auto mb-3" />
          <p className="text-sm text-dark-500 dark:text-dark-400 mb-1">Még nincsenek elemzések.</p>
          <p className="text-xs text-dark-400 dark:text-dark-600">
            Kérj elemzést az AI edzőtől!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => {
            const style = INSIGHT_STYLES[insight.insight_type] || INSIGHT_STYLES.tip;
            const Icon = style.icon;
            return (
              <div
                key={insight.id}
                onClick={() => !insight.is_read && markRead(insight.id)}
                className={clsx(
                  'p-4 rounded-xl border transition-all cursor-pointer group relative',
                  style.bg,
                  style.border,
                  !insight.is_read && 'ring-1 ring-primary-300 dark:ring-primary-700'
                )}
              >
                {!insight.is_read && (
                  <span className="absolute top-3 right-10 w-2 h-2 bg-primary-500 rounded-full" />
                )}
                <div className="flex items-start gap-3">
                  <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', style.bg, 'border', style.border)}>
                    <Icon className={clsx('w-4 h-4', style.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-dark-900 dark:text-white mb-1">
                      {insight.title}
                    </p>
                    <p className="text-xs text-dark-600 dark:text-dark-300 leading-relaxed line-clamp-3">
                      {insight.content}
                    </p>
                    <p className="text-[10px] text-dark-400 mt-2">
                      {format(new Date(insight.created_at), 'yyyy. MMM d. HH:mm', { locale: hu })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteInsight(insight.id); }}
                    className="w-6 h-6 rounded flex items-center justify-center text-dark-300 hover:text-error-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
