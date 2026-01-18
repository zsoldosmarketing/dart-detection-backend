import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Play,
  CheckCircle,
  Lock,
  Target,
  ChevronRight,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { t } from '../lib/i18n';

interface Program {
  id: string;
  name_key: string;
  desc_key: string;
  difficulty: number;
  duration_days: number;
  daily_minutes: number;
  config: {
    schedule?: { day: number; drills: string[] }[];
  };
}

interface Enrollment {
  id: string;
  program_id: string;
  started_at: string;
  completed_at: string | null;
  current_day: number;
  progress_pct: number;
}

interface Drill {
  id: string;
  name_key: string;
  desc_key: string;
  category: string;
  estimated_minutes: number;
}

interface CompletedSession {
  drill_id: string;
  day_number: number;
}

export function ProgramDetailPage() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [program, setProgram] = useState<Program | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startingDrill, setStartingDrill] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (enrollmentId && user) {
      fetchData();
    }
  }, [enrollmentId, user]);

  const fetchData = async () => {
    setIsLoading(true);

    const { data: enrollmentData } = await supabase
      .from('program_enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .maybeSingle();

    if (!enrollmentData) {
      navigate('/programs');
      return;
    }

    setEnrollment(enrollmentData);

    const { data: programData } = await supabase
      .from('programs')
      .select('*')
      .eq('id', enrollmentData.program_id)
      .maybeSingle();

    if (programData) {
      setProgram(programData);
    }

    const { data: drillsData } = await supabase
      .from('drills')
      .select('*')
      .eq('is_active', true);

    if (drillsData) {
      setDrills(drillsData);
    }

    const { data: sessionsData } = await supabase
      .from('training_sessions')
      .select('drill_id, program_day')
      .eq('user_id', user!.id)
      .eq('program_id', enrollmentData.program_id)
      .eq('status', 'completed')
      .gte('started_at', enrollmentData.started_at);

    if (sessionsData) {
      const completed = sessionsData
        .filter((s) => s.program_day !== null)
        .map((s) => ({
          drill_id: s.drill_id,
          day_number: s.program_day!,
        }));
      setCompletedSessions(completed);

      if (programData?.config?.schedule) {
        const totalDays = programData.config.schedule.length;
        const completedDayNumbers = new Set(completed.map(c => c.day_number));
        const completedDaysCount = programData.config.schedule.filter((_, i) => {
          const dayNumber = i + 1;
          const daySchedule = programData.config.schedule.find(s => s.day === dayNumber);
          if (!daySchedule) return false;
          const drillCategories = daySchedule.drills || daySchedule.drills_by_category || [];
          const dayCompletedDrills = completed.filter(s => s.day_number === dayNumber);
          return dayCompletedDrills.length >= drillCategories.length;
        }).length;

        const newProgress = Math.round((completedDaysCount / totalDays) * 100);
        const nextDay = Math.min(completedDaysCount + 1, totalDays);

        if (newProgress !== enrollmentData.progress_pct || nextDay !== enrollmentData.current_day) {
          await supabase
            .from('program_enrollments')
            .update({
              progress_pct: newProgress,
              current_day: nextDay,
              completed_at: newProgress === 100 ? new Date().toISOString() : null,
            })
            .eq('id', enrollmentId);

          setEnrollment({
            ...enrollmentData,
            progress_pct: newProgress,
            current_day: nextDay,
            completed_at: newProgress === 100 ? new Date().toISOString() : null,
          });
        }
      }
    }

    setIsLoading(false);
  };

  const getDrillsByCategory = (category: string): Drill[] => {
    return drills.filter((d) => d.category === category);
  };

  const seededRandom = (seed: number): number => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  const getDeterministicDrill = (category: string, dayNumber: number, categoryIndex: number): Drill | null => {
    const categoryDrills = getDrillsByCategory(category);
    if (categoryDrills.length === 0) return null;

    const seed = (enrollmentId?.charCodeAt(0) || 1) * 1000 + dayNumber * 10 + categoryIndex;
    const index = Math.floor(seededRandom(seed) * categoryDrills.length);
    return categoryDrills[index];
  };

  const getDayDrills = (dayNumber: number): Drill[] => {
    if (!program?.config?.schedule) return [];
    const daySchedule = program.config.schedule.find((s) => s.day === dayNumber);
    if (!daySchedule) return [];

    const drillCategories = daySchedule.drills || daySchedule.drills_by_category || [];
    return drillCategories
      .map((category, idx) => getDeterministicDrill(category, dayNumber, idx))
      .filter((d): d is Drill => d !== null);
  };

  const isDayCompleted = (dayNumber: number): boolean => {
    if (!program?.config?.schedule) return false;
    const daySchedule = program.config.schedule.find((s) => s.day === dayNumber);
    if (!daySchedule) return false;

    const drillCategories = daySchedule.drills || daySchedule.drills_by_category || [];
    const dayCompletedDrills = completedSessions.filter((s) => s.day_number === dayNumber);
    return dayCompletedDrills.length >= drillCategories.length;
  };

  const isDayUnlocked = (dayNumber: number): boolean => {
    if (dayNumber === 1) return true;
    return isDayCompleted(dayNumber - 1);
  };

  const startDrill = async (drill: Drill, dayNumber: number) => {
    if (!user || !enrollment) {
      setError(t('error.authentication_required'));
      return;
    }

    setStartingDrill(drill.id);
    setError(null);

    try {
      const { data: session, error: insertError } = await supabase
        .from('training_sessions')
        .insert({
          user_id: user.id,
          drill_id: drill.id,
          program_id: enrollment.program_id,
          program_day: dayNumber,
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('Failed to start drill:', insertError);
        setError(`${t('error.failed_to_start')}: ${insertError.message}`);
        setStartingDrill(null);
        return;
      }

      if (!session) {
        setError(t('error.failed_to_create_session'));
        setStartingDrill(null);
        return;
      }

      navigate(`/training/${session.id}`);
    } catch (err) {
      console.error('Error starting drill:', err);
      setError(t('error.unexpected_error'));
      setStartingDrill(null);
    }
  };

  const calculateProgress = (): number => {
    if (!program?.config?.schedule) return 0;
    const totalDays = program.config.schedule.length;
    const completedDays = program.config.schedule.filter((_, i) =>
      isDayCompleted(i + 1)
    ).length;
    return Math.round((completedDays / totalDays) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!program || !enrollment) {
    return null;
  }

  const progress = calculateProgress();
  const currentDay = enrollment.current_day || 1;

  return (
    <div className="space-y-6 animate-fade-in">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/programs')}
          className="p-2 hover:bg-dark-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-dark-600 dark:text-dark-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">
            {t(program.name_key)}
          </h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            {t(program.desc_key)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary-500 to-primary-600 text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-primary-100 text-sm">{t('program.current_day')}</p>
              <p className="text-2xl font-bold">
                {currentDay} / {program.duration_days}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <p className="text-green-100 text-sm">{t('program.progress')}</p>
              <p className="text-2xl font-bold">{progress}%</p>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-amber-100 text-sm">{t('program.daily_time')}</p>
              <p className="text-2xl font-bold">~{program.daily_minutes} {t('training.minutes')}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="bg-dark-100 dark:bg-dark-800 rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-dark-900 dark:text-white">
          {t('program.schedule')}
        </h2>

        <div className="grid gap-3">
          {program.config?.schedule?.map((daySchedule) => {
            const dayNumber = daySchedule.day;
            const isCompleted = isDayCompleted(dayNumber);
            const isUnlocked = isDayUnlocked(dayNumber);
            const isCurrentDay = dayNumber === currentDay;
            const dayDrills = getDayDrills(dayNumber);

            return (
              <Card
                key={dayNumber}
                className={`transition-all ${
                  isCurrentDay
                    ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : ''
                } ${!isUnlocked ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                      isCompleted
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : isCurrentDay
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                        : 'bg-dark-100 dark:bg-dark-700 text-dark-500'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : !isUnlocked ? (
                      <Lock className="w-5 h-5" />
                    ) : (
                      dayNumber
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-dark-900 dark:text-white">
                        {t('program.day')} {dayNumber}
                      </h3>
                      {isCurrentDay && (
                        <Badge variant="primary" size="sm">
                          {t('program.today')}
                        </Badge>
                      )}
                      {isCompleted && (
                        <Badge variant="success" size="sm">
                          {t('program.done')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(daySchedule.drills || daySchedule.drills_by_category || []).map((category, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-0.5 bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 rounded"
                        >
                          {t(`category.${category}`)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {isUnlocked && !isCompleted && dayDrills.length > 0 && (
                    <Button
                      size="sm"
                      onClick={() => startDrill(dayDrills[0], dayNumber)}
                      leftIcon={<Play className="w-4 h-4" />}
                      isLoading={startingDrill === dayDrills[0].id}
                    >
                      {t('training.start_practice')}
                    </Button>
                  )}

                  {isCompleted && (
                    <ChevronRight className="w-5 h-5 text-dark-400" />
                  )}
                </div>

                {isCurrentDay && isUnlocked && !isCompleted && dayDrills.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-dark-200 dark:border-dark-700">
                    <p className="text-sm text-dark-500 dark:text-dark-400 mb-3">
                      {t('program.todays_drills')}:
                    </p>
                    <div className="grid gap-2">
                      {dayDrills.map((drill, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-dark-50 dark:bg-dark-800 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-dark-900 dark:text-white">
                              {t(drill.name_key)}
                            </p>
                            <p className="text-xs text-dark-500">
                              ~{drill.estimated_minutes} {t('training.minutes')}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => startDrill(drill, dayNumber)}
                            isLoading={startingDrill === drill.id}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
