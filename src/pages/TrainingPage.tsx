import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Clock, Flame, Filter, ChevronRight, Play, X } from 'lucide-react';
import { Card, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { Tables } from '../lib/supabase';

type DrillCategory = 'all' | 'doubles' | 'triples' | 'sectors' | 'bull' | 'checkout' | 'setup' | 'general' | 'pressure';

const categories: { value: DrillCategory; labelKey: string }[] = [
  { value: 'all', labelKey: 'category.all' },
  { value: 'doubles', labelKey: 'category.doubles' },
  { value: 'triples', labelKey: 'category.triples' },
  { value: 'sectors', labelKey: 'category.sectors' },
  { value: 'bull', labelKey: 'category.bull' },
  { value: 'checkout', labelKey: 'category.checkout' },
  { value: 'setup', labelKey: 'category.setup' },
  { value: 'general', labelKey: 'category.general' },
  { value: 'pressure', labelKey: 'category.pressure' },
];

interface ActiveSession {
  id: string;
  drill_id: string;
  status: string;
  started_at: string;
  drill: {
    name_key: string;
    category: string;
  };
}

export function TrainingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [drills, setDrills] = useState<Tables['drills'][]>([]);
  const [programs, setPrograms] = useState<Tables['programs'][]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<DrillCategory>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'drills' | 'programs'>('drills');
  const [isStarting, setIsStarting] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<{ groupKey: string; drills: Tables['drills'][] } | null>(null);

  useEffect(() => {
    fetchData();
  }, [user]);

  async function fetchData() {
    setIsLoading(true);

    const [drillsRes, programsRes] = await Promise.all([
      supabase.from('drills').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('programs').select('*').eq('is_active', true).order('sort_order'),
    ]);

    if (drillsRes.data) setDrills(drillsRes.data);
    if (programsRes.data) setPrograms(programsRes.data);

    if (user) {
      const { data: sessionsData } = await supabase
        .from('training_sessions')
        .select('id, drill_id, status, started_at, drills!inner(name_key, category)')
        .eq('user_id', user.id)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(5);

      if (sessionsData) {
        setActiveSessions(sessionsData.map(s => ({
          id: s.id,
          drill_id: s.drill_id,
          status: s.status,
          started_at: s.started_at,
          drill: Array.isArray(s.drills) ? s.drills[0] : s.drills
        })));
      }
    }

    setIsLoading(false);
  }

  const filteredDrills = drills.filter(
    (drill) => selectedCategory === 'all' || drill.category === selectedCategory
  );

  const groupedDrills = filteredDrills.reduce((acc, drill) => {
    if (drill.group_key) {
      if (!acc[drill.group_key]) {
        acc[drill.group_key] = {
          groupKey: drill.group_key,
          groupNameKey: drill.group_name_key || drill.group_key,
          drills: [],
        };
      }
      acc[drill.group_key].drills.push(drill);
    }
    return acc;
  }, {} as Record<string, { groupKey: string; groupNameKey: string; drills: Tables['drills'][] }>);

  const ungroupedDrills = filteredDrills.filter(d => !d.group_key);
  const drillGroups = Object.values(groupedDrills);

  const startDrill = async (drillId: string) => {
    if (!user) return;
    setIsStarting(drillId);

    const { data: session, error } = await supabase
      .from('training_sessions')
      .insert({
        user_id: user.id,
        drill_id: drillId,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to start drill:', error);
      setIsStarting(null);
      return;
    }

    navigate(`/training/${session.id}`);
  };

  const startProgram = async (programId: string) => {
    if (!user) return;
    setIsStarting(programId);

    const { data: existing } = await supabase
      .from('program_enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('program_id', programId)
      .maybeSingle();

    if (existing) {
      navigate(`/programs/${existing.id}`);
      return;
    }

    const { data: enrollment, error } = await supabase
      .from('program_enrollments')
      .insert({
        user_id: user.id,
        program_id: programId,
        current_day: 1,
        progress_pct: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to enroll:', error);
      setIsStarting(null);
      return;
    }

    navigate(`/programs/${enrollment.id}`);
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm(t('training.confirm_delete_session'))) {
      return;
    }

    setActiveSessions(prev => prev.filter(s => s.id !== sessionId));

    const { error } = await supabase
      .from('training_sessions')
      .update({ status: 'abandoned' })
      .eq('id', sessionId)
      .eq('user_id', user?.id || '');

    if (error) {
      console.error('Failed to abandon session:', error);
      alert(t('error.delete_failed'));
      await fetchData();
      return;
    }
  };

  const getCategoryColor = (category: string): 'primary' | 'secondary' | 'success' | 'warning' | 'error' => {
    const colors: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'error'> = {
      doubles: 'primary',
      triples: 'secondary',
      sectors: 'success',
      bull: 'warning',
      checkout: 'error',
      setup: 'primary',
      general: 'secondary',
      pressure: 'error',
    };
    return colors[category] || 'primary';
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
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">{t('nav.training')}</h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            {t('training.select_practice')}
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-dark-200 dark:border-dark-700">
        <button
          onClick={() => setActiveTab('drills')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'drills'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-dark-500 hover:text-dark-700 dark:hover:text-dark-300'
          }`}
        >
          {t('training.drills_tab')} ({drills.length})
        </button>
        <button
          onClick={() => setActiveTab('programs')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'programs'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-dark-500 hover:text-dark-700 dark:hover:text-dark-300'
          }`}
        >
          {t('training.programs_tab')} ({programs.length})
        </button>
      </div>

      {activeTab === 'drills' && (
        <>
          {activeSessions.length > 0 && (
            <Card className="bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 border-primary-200 dark:border-primary-800">
              <div>
                <h3 className="font-semibold text-dark-900 dark:text-white flex items-center gap-2">
                  <Flame className="w-5 h-5 text-primary-600" />
                  {t('training.active_sessions')}
                </h3>
                <p className="text-sm text-dark-600 dark:text-dark-400 mt-1">{t('training.continue_sessions')}</p>
                <div className="mt-4 space-y-2">
                  {activeSessions.map((session) => (
                    <div
                      key={session.id}
                      className="w-full flex items-center justify-between p-3 bg-white dark:bg-dark-700 rounded-lg hover:ring-2 hover:ring-primary-500 transition-all group"
                    >
                      <button
                        onClick={() => navigate(`/training/${session.id}`)}
                        className="flex items-center gap-3 flex-1 text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                          <Target className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <p className="font-medium text-dark-900 dark:text-white">{t(session.drill.name_key)}</p>
                          <p className="text-xs text-dark-500 dark:text-dark-400">
                            {new Date(session.started_at).toLocaleDateString()}
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => deleteSession(session.id, e)}
                          className="p-2 text-error-500 hover:text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-900/30 rounded-lg transition-colors"
                          title={t('common.delete')}
                        >
                          <X className="w-5 h-5" />
                        </button>
                        <ChevronRight className="w-5 h-5 text-primary-600" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            <div className="flex gap-2 min-w-min">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-700'
                  }`}
                >
                  {t(cat.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {drillGroups.map((group) => (
              <DrillGroupCard
                key={group.groupKey}
                group={group}
                categoryColor={getCategoryColor(group.drills[0]?.category)}
                onSelect={() => setSelectedGroup({ groupKey: group.groupKey, drills: group.drills })}
              />
            ))}
            {ungroupedDrills.map((drill) => (
              <DrillCard
                key={drill.id}
                drill={drill}
                categoryColor={getCategoryColor(drill.category)}
                onStart={() => startDrill(drill.id)}
                isStarting={isStarting === drill.id}
              />
            ))}
          </div>

          {filteredDrills.length === 0 && (
            <Card className="text-center py-12">
              <Target className="w-12 h-12 text-dark-400 mx-auto mb-4" />
              <p className="text-dark-500 dark:text-dark-400">
                {t('training.no_drills')}
              </p>
            </Card>
          )}
        </>
      )}

      {activeTab === 'programs' && (
        <>
          <Card className="bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 border-primary-200 dark:border-primary-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-dark-900 dark:text-white">{t('training.my_programs')}</h3>
                <p className="text-sm text-dark-600 dark:text-dark-400 mt-1">{t('training.view_all_programs')}</p>
              </div>
              <Button variant="primary" leftIcon={<ChevronRight className="w-4 h-4" />} onClick={() => navigate('/programs')}>
                {t('training.manage_programs')}
              </Button>
            </div>
          </Card>
          <div className="grid sm:grid-cols-2 gap-4">
            {programs.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                onStart={() => startProgram(program.id)}
                isStarting={isStarting === program.id}
              />
            ))}
          </div>
        </>
      )}

      {selectedGroup && (
        <DrillSelectorModal
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
          onSelectDrill={(drillId) => {
            setSelectedGroup(null);
            startDrill(drillId);
          }}
          isStarting={isStarting}
        />
      )}
    </div>
  );
}

interface DrillCardProps {
  drill: Tables['drills'];
  categoryColor: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  onStart: () => void;
  isStarting: boolean;
}

function DrillCard({ drill, categoryColor, onStart, isStarting }: DrillCardProps) {
  return (
    <Card hover className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <Badge variant={categoryColor} size="sm">
          {t(`category.${drill.category}`)}
        </Badge>
      </div>
      <h3 className="font-semibold text-dark-900 dark:text-white mt-3">
        {t(drill.name_key)}
      </h3>
      <p className="text-sm text-dark-500 dark:text-dark-400 mt-1 flex-1">
        {t(drill.desc_key)}
      </p>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-dark-200 dark:border-dark-700">
        <div className="flex items-center gap-1 text-sm text-dark-500">
          <Clock className="w-4 h-4" />
          <span>~{drill.estimated_minutes} {t('training.minutes')}</span>
        </div>
        <Button
          size="sm"
          leftIcon={<Play className="w-4 h-4" />}
          onClick={onStart}
          isLoading={isStarting}
        >
          {t('training.start_practice')}
        </Button>
      </div>
    </Card>
  );
}

interface ProgramCardProps {
  program: Tables['programs'];
  onStart: () => void;
  isStarting: boolean;
}

function ProgramCard({ program, onStart, isStarting }: ProgramCardProps) {
  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return t('program.difficulty.beginner');
      case 'intermediate':
        return t('program.difficulty.intermediate');
      case 'advanced':
        return t('program.difficulty.advanced');
      default:
        return difficulty;
    }
  };

  return (
    <Card hover className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <Badge variant="primary" size="sm">
          {program.duration_days} {t('training.days')}
        </Badge>
        <Badge variant="secondary" size="sm">
          {getDifficultyLabel(program.difficulty)}
        </Badge>
      </div>
      <h3 className="font-semibold text-dark-900 dark:text-white mt-3">
        {t(program.name_key)}
      </h3>
      <p className="text-sm text-dark-500 dark:text-dark-400 mt-1 flex-1">
        {t(program.desc_key)}
      </p>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-dark-200 dark:border-dark-700">
        <div className="flex items-center gap-1 text-sm text-dark-500">
          <Clock className="w-4 h-4" />
          <span>~{program.daily_minutes} {t('training.daily_minutes')}</span>
        </div>
        <Button size="sm" leftIcon={<Play className="w-4 h-4" />} onClick={onStart} isLoading={isStarting}>
          {t('training.start_practice')}
        </Button>
      </div>
    </Card>
  );
}

interface DrillGroupCardProps {
  group: { groupKey: string; groupNameKey: string; drills: Tables['drills'][] };
  categoryColor: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  onSelect: () => void;
}

function DrillGroupCard({ group, categoryColor, onSelect }: DrillGroupCardProps) {
  return (
    <Card hover className="flex flex-col cursor-pointer" onClick={onSelect}>
      <div className="flex items-start justify-between gap-2">
        <Badge variant={categoryColor} size="sm">
          {t(`category.${group.drills[0]?.category}`)}
        </Badge>
        <Badge variant="secondary" size="sm">
          {group.drills.length} {t('training.options')}
        </Badge>
      </div>
      <h3 className="font-semibold text-dark-900 dark:text-white mt-3">
        {t(group.groupNameKey)}
      </h3>
      <p className="text-sm text-dark-500 dark:text-dark-400 mt-1 flex-1">
        {t('training.select_variation')}
      </p>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-dark-200 dark:border-dark-700">
        <div className="flex items-center gap-1 text-sm text-dark-500">
          <Target className="w-4 h-4" />
          <span>{t('training.multiple_drills')}</span>
        </div>
        <ChevronRight className="w-5 h-5 text-primary-600" />
      </div>
    </Card>
  );
}

interface DrillSelectorModalProps {
  group: { groupKey: string; drills: Tables['drills'][] };
  onClose: () => void;
  onSelectDrill: (drillId: string) => void;
  isStarting: string | null;
}

function DrillSelectorModal({ group, onClose, onSelectDrill, isStarting }: DrillSelectorModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-dark-200 dark:border-dark-700">
          <h2 className="text-xl font-bold text-dark-900 dark:text-white">
            {t(group.drills[0]?.group_name_key || 'training.select_drill')}
          </h2>
          <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">
            {t('training.choose_variation')}
          </p>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)] space-y-3">
          {group.drills.map((drill) => (
            <div
              key={drill.id}
              className="p-4 border border-dark-200 dark:border-dark-700 rounded-xl hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors cursor-pointer"
              onClick={() => onSelectDrill(drill.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-dark-900 dark:text-white">
                    {t(drill.name_key)}
                  </h3>
                  <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">
                    {t(drill.desc_key)}
                  </p>
                  <div className="flex items-center gap-1 text-sm text-dark-500 mt-2">
                    <Clock className="w-4 h-4" />
                    <span>~{drill.estimated_minutes} {t('training.minutes')}</span>
                  </div>
                </div>
                {isStarting === drill.id ? (
                  <div className="w-6 h-6 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-6 h-6 text-primary-600 flex-shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
