import { useState, useEffect } from 'react';
import { Plus, Target, Trophy, Flame, TrendingUp, CheckCircle, Trash2, Calendar, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import clsx from 'clsx';

interface Goal {
  id: string;
  title: string;
  description: string;
  goal_type: string;
  target_value: number;
  current_value: number;
  unit: string;
  deadline: string | null;
  status: string;
  created_at: string;
}

const GOAL_TYPES = [
  { value: 'average', label: 'Átlag javítás', icon: TrendingUp, unit: 'pont', placeholder: 'pl. 65.0' },
  { value: 'checkout', label: 'Kiszálló %', icon: Target, unit: '%', placeholder: 'pl. 40' },
  { value: 'wins', label: 'Győzelmek száma', icon: Trophy, unit: 'győzelem', placeholder: 'pl. 50' },
  { value: 'streak', label: 'Győzelmi sorozat', icon: Flame, unit: 'meccs', placeholder: 'pl. 5' },
  { value: 'custom', label: 'Egyedi cél', icon: CheckCircle, unit: '', placeholder: 'pl. 10' },
];

const TYPE_COLORS: Record<string, string> = {
  average: 'text-primary-600 bg-primary-50 dark:bg-primary-900/20',
  checkout: 'text-success-600 bg-success-50 dark:bg-success-900/20',
  wins: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
  streak: 'text-error-600 bg-error-50 dark:bg-error-900/20',
  custom: 'text-secondary-600 bg-secondary-50 dark:bg-secondary-900/20',
};

export function AIGoalsPanel() {
  const { user } = useAuthStore();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    goal_type: 'average',
    target_value: '',
    unit: 'pont',
    deadline: '',
  });

  useEffect(() => {
    if (user) fetchGoals();
  }, [user]);

  const fetchGoals = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ai_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setGoals(data as Goal[]);
    setIsLoading(false);
  };

  const handleTypeChange = (type: string) => {
    const t = GOAL_TYPES.find(t => t.value === type);
    setForm(prev => ({ ...prev, goal_type: type, unit: t?.unit || '' }));
  };

  const handleSave = async () => {
    if (!user || !form.title.trim() || !form.target_value) return;
    setSaving(true);
    const { error } = await supabase.from('ai_goals').insert({
      user_id: user.id,
      title: form.title.trim(),
      description: form.description.trim(),
      goal_type: form.goal_type,
      target_value: parseFloat(form.target_value),
      current_value: 0,
      unit: form.unit,
      deadline: form.deadline || null,
      status: 'active',
    });
    if (!error) {
      setShowForm(false);
      setForm({ title: '', description: '', goal_type: 'average', target_value: '', unit: 'pont', deadline: '' });
      fetchGoals();
    }
    setSaving(false);
  };

  const handleComplete = async (id: string) => {
    await supabase.from('ai_goals').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', id);
    fetchGoals();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('ai_goals').delete().eq('id', id);
    setGoals(prev => prev.filter(g => g.id !== id));
  };

  const active = goals.filter(g => g.status === 'active');
  const completed = goals.filter(g => g.status === 'completed');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-dark-900 dark:text-white">Céljaim</h3>
          <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">
            {active.length} aktív cél
          </p>
        </div>
        <Button
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setShowForm(!showForm)}
        >
          Új cél
        </Button>
      </div>

      {showForm && (
        <Card className="border-2 border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/10">
          <h4 className="font-semibold text-dark-900 dark:text-white mb-4">Új cél hozzáadása</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1.5">
                Cél típusa
              </label>
              <div className="grid grid-cols-2 gap-2">
                {GOAL_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      onClick={() => handleTypeChange(type.value)}
                      className={clsx(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all text-sm',
                        form.goal_type === type.value
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-400 hover:border-primary-300'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate text-xs">{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1">Cél neve *</label>
              <input
                value={form.title}
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="pl. Elér 65-ös átlagot"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1">
                  Célérték *
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={form.target_value}
                    onChange={(e) => setForm(prev => ({ ...prev, target_value: e.target.value }))}
                    placeholder={GOAL_TYPES.find(t => t.value === form.goal_type)?.placeholder}
                    className="flex-1 px-3 py-2 text-sm bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                  <span className="text-xs text-dark-500 shrink-0">{form.unit}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1">
                  Határidő
                </label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-400" />
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => setForm(prev => ({ ...prev, deadline: e.target.value }))}
                    className="w-full pl-8 pr-2 py-2 text-sm bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1">
                Leírás (opcionális)
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Miért fontos ez a cél számodra?"
                rows={2}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)} className="flex-1">
                Mégse
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                isLoading={saving}
                disabled={!form.title.trim() || !form.target_value}
                className="flex-1"
              >
                Mentés
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-20 bg-dark-100 dark:bg-dark-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : active.length === 0 && !showForm ? (
        <div className="text-center py-8">
          <Target className="w-10 h-10 text-dark-300 dark:text-dark-600 mx-auto mb-3" />
          <p className="text-sm text-dark-500 dark:text-dark-400 mb-3">Még nincsenek céljaid.</p>
          <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>
            Első célom
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map((goal) => {
            const pct = goal.target_value > 0
              ? Math.min((goal.current_value / goal.target_value) * 100, 100)
              : 0;
            const typeInfo = GOAL_TYPES.find(t => t.value === goal.goal_type);
            const Icon = typeInfo?.icon || Target;
            const colorClass = TYPE_COLORS[goal.goal_type] || TYPE_COLORS.custom;

            return (
              <div key={goal.id} className="p-4 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-xl hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', colorClass)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dark-900 dark:text-white truncate">{goal.title}</p>
                      {goal.deadline && (
                        <p className="text-[10px] text-dark-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(goal.deadline), 'yyyy. MMM d.', { locale: hu })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleComplete(goal.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-dark-400 hover:text-success-600 hover:bg-success-50 dark:hover:bg-success-900/20 transition-colors"
                      title="Teljesítve"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-dark-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
                      title="Törlés"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-dark-500 dark:text-dark-400">
                      {goal.current_value} / {goal.target_value} {goal.unit}
                    </span>
                    <span className="font-semibold text-dark-700 dark:text-dark-300">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-dark-100 dark:bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {completed.length > 0 && (
        <div className="pt-2">
          <p className="text-xs font-medium text-dark-500 dark:text-dark-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-success-500" />
            Teljesített célok ({completed.length})
          </p>
          <div className="space-y-2">
            {completed.slice(0, 3).map(goal => (
              <div key={goal.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success-50/50 dark:bg-success-900/10 border border-success-100 dark:border-success-900/30">
                <CheckCircle className="w-4 h-4 text-success-600 shrink-0" />
                <span className="text-sm text-dark-600 dark:text-dark-400 line-through truncate">{goal.title}</span>
                <Badge variant="success" size="sm" className="ml-auto shrink-0">Kész</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
