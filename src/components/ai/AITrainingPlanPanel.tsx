import { useState, useEffect } from 'react';
import { Sparkles, Calendar, Dumbbell, ChevronDown, ChevronUp, Trash2, Loader2, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import clsx from 'clsx';

interface PlanDay {
  day: number;
  title: string;
  drills: { name: string; sets?: number; reps?: number; duration?: string; notes?: string }[];
  focus: string;
}

interface TrainingPlan {
  id: string;
  title: string;
  description: string;
  duration_days: number;
  days: PlanDay[];
  focus_areas: string[];
  status: string;
  created_at: string;
}

interface AITrainingPlanPanelProps {
  onRequestPlan: () => void;
  isGenerating: boolean;
}

export function AITrainingPlanPanel({ onRequestPlan, isGenerating }: AITrainingPlanPanelProps) {
  const { user } = useAuthStore();
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  useEffect(() => {
    if (user) fetchPlans();
  }, [user]);

  const fetchPlans = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ai_training_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (data) setPlans(data as TrainingPlan[]);
    setIsLoading(false);
  };

  const archivePlan = async (id: string) => {
    await supabase.from('ai_training_plans').update({ status: 'archived' }).eq('id', id);
    setPlans(prev => prev.filter(p => p.id !== id));
  };

  const DAY_LABELS = ['H', 'K', 'Sz', 'Cs', 'P', 'Szo', 'V'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-dark-900 dark:text-white">AI Edzéstervek</h3>
          <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">
            {plans.length} aktív terv
          </p>
        </div>
        <Button
          size="sm"
          leftIcon={isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          onClick={onRequestPlan}
          disabled={isGenerating}
        >
          Új terv
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-28 bg-dark-100 dark:bg-dark-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-100 to-secondary-100 dark:from-primary-900/30 dark:to-secondary-900/30 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7 text-primary-500" />
          </div>
          <p className="text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
            Nincs edzésterved
          </p>
          <p className="text-xs text-dark-500 dark:text-dark-400 mb-4 max-w-[200px] mx-auto">
            Kérj egy személyre szabott edzéstervet az AI edzőtől!
          </p>
          <Button
            size="sm"
            leftIcon={<Sparkles className="w-4 h-4" />}
            onClick={onRequestPlan}
            disabled={isGenerating}
          >
            Edzésterv generálása
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => {
            const isExpanded = expandedPlan === plan.id;
            const days = Array.isArray(plan.days) ? plan.days : [];

            return (
              <div key={plan.id} className="border border-dark-200 dark:border-dark-700 rounded-xl overflow-hidden bg-white dark:bg-dark-800">
                <div
                  className="p-4 cursor-pointer hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors"
                  onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Dumbbell className="w-4 h-4 text-primary-500 shrink-0" />
                        <p className="font-semibold text-dark-900 dark:text-white text-sm truncate">{plan.title}</p>
                      </div>
                      <p className="text-xs text-dark-500 dark:text-dark-400 line-clamp-2 mb-2">{plan.description}</p>
                      <div className="flex items-center gap-3 text-xs text-dark-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {plan.duration_days} napos terv
                        </span>
                        <span>
                          {format(new Date(plan.created_at), 'MMM d.', { locale: hu })}
                        </span>
                      </div>
                      {plan.focus_areas && plan.focus_areas.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {plan.focus_areas.map((area, i) => (
                            <Badge key={i} variant="secondary" size="sm">{area}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); archivePlan(plan.id); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-dark-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-dark-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-dark-400" />
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && days.length > 0 && (
                  <div className="border-t border-dark-200 dark:border-dark-700 p-4 space-y-2 bg-dark-50/50 dark:bg-dark-800/50">
                    {days.map((day, idx) => {
                      const isDayExpanded = expandedDay === idx;
                      return (
                        <div key={idx} className="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg overflow-hidden">
                          <button
                            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors"
                            onClick={() => setExpandedDay(isDayExpanded ? null : idx)}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                                  {DAY_LABELS[idx % 7]}
                                </span>
                              </div>
                              <div className="text-left">
                                <p className="text-xs font-semibold text-dark-800 dark:text-dark-200">{day.title}</p>
                                <p className="text-[10px] text-dark-500">{day.focus}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="default" size="sm">
                                {day.drills?.length || 0} drill
                              </Badge>
                              {isDayExpanded ? (
                                <ChevronUp className="w-4 h-4 text-dark-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-dark-400" />
                              )}
                            </div>
                          </button>
                          {isDayExpanded && day.drills && day.drills.length > 0 && (
                            <div className="border-t border-dark-100 dark:border-dark-700 px-3 pb-3 pt-2 space-y-1.5">
                              {day.drills.map((drill, di) => (
                                <div key={di} className="flex items-start gap-2 py-1.5 border-b border-dark-50 dark:border-dark-700/50 last:border-0">
                                  <div className="w-5 h-5 rounded bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="text-[9px] font-bold text-primary-600">{di + 1}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-dark-800 dark:text-dark-200">{drill.name}</p>
                                    <div className="flex flex-wrap gap-2 mt-0.5">
                                      {drill.sets && (
                                        <span className="text-[10px] text-dark-500">{drill.sets} sorozat</span>
                                      )}
                                      {drill.reps && (
                                        <span className="text-[10px] text-dark-500">{drill.reps} ismétlés</span>
                                      )}
                                      {drill.duration && (
                                        <span className="text-[10px] text-dark-500">{drill.duration}</span>
                                      )}
                                    </div>
                                    {drill.notes && (
                                      <p className="text-[10px] text-dark-400 mt-0.5 italic">{drill.notes}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
