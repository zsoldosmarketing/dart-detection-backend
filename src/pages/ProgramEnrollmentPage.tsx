import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Clock,
  Trophy,
  CheckCircle,
  Play,
  Lock,
  Star,
  Calendar,
  X,
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
  is_active: boolean;
  sort_order: number;
}

interface Enrollment {
  id: string;
  program_id: string;
  started_at: string;
  completed_at: string | null;
  current_day: number;
  progress_pct: number;
}

interface ProgramWithEnrollment extends Program {
  enrollment?: Enrollment;
}

export function ProgramEnrollmentPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [programs, setPrograms] = useState<ProgramWithEnrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'enrolled' | 'available'>('all');

  useEffect(() => {
    fetchPrograms();
  }, [user]);

  const fetchPrograms = async () => {
    setIsLoading(true);

    const { data: programsData } = await supabase
      .from('programs')
      .select('*')
      .order('sort_order');

    if (!programsData) {
      setIsLoading(false);
      return;
    }

    let enrollments: Enrollment[] = [];
    if (user) {
      const { data: enrollmentsData } = await supabase
        .from('program_enrollments')
        .select('*')
        .eq('user_id', user.id);
      enrollments = enrollmentsData || [];
    }

    const programsWithData: ProgramWithEnrollment[] = programsData.map((program) => ({
      ...program,
      enrollment: enrollments.find((e) => e.program_id === program.id),
    }));

    setPrograms(programsWithData);
    setIsLoading(false);
  };

  const enrollInProgram = async (programId: string) => {
    if (!user) return;
    setEnrollingId(programId);

    try {
      const { error } = await supabase.from('program_enrollments').insert({
        user_id: user.id,
        program_id: programId,
        current_day: 1,
        progress_pct: 0,
      });

      if (error) throw error;

      await fetchPrograms();
    } catch (err) {
      console.error('Failed to enroll:', err);
    } finally {
      setEnrollingId(null);
    }
  };

  const continueProgram = (enrollmentId: string) => {
    navigate(`/programs/${enrollmentId}`);
  };

  const deleteEnrollment = async (enrollmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm(t('program.confirm_delete_enrollment'))) {
      return;
    }

    const { error } = await supabase
      .from('program_enrollments')
      .delete()
      .eq('id', enrollmentId);

    if (error) {
      console.error('Failed to delete enrollment:', error);
      alert(t('error.delete_failed'));
      return;
    }

    await fetchPrograms();
  };

  const filteredPrograms = programs.filter((p) => {
    if (filter === 'enrolled') return !!p.enrollment;
    if (filter === 'available') return !p.enrollment;
    return true;
  });

  const enrolledCount = programs.filter((p) => p.enrollment).length;
  const completedCount = programs.filter((p) => p.enrollment?.completed_at).length;

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
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">
            {t('program.enrollment_title')}
          </h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            {t('program.enrollment_desc')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary-500 to-primary-600 text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-primary-100 text-sm">{t('program.enrolled')}</p>
              <p className="text-2xl font-bold">{enrolledCount}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-green-100 text-sm">{t('program.completed')}</p>
              <p className="text-2xl font-bold">{completedCount}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-amber-100 text-sm">{t('program.available')}</p>
              <p className="text-2xl font-bold">{programs.length - enrolledCount}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex gap-2">
        {(['all', 'enrolled', 'available'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-primary-600 text-white'
                : 'bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-700'
            }`}
          >
            {f === 'all' && `${t('program.all')} (${programs.length})`}
            {f === 'enrolled' && `${t('program.enrolled')} (${enrolledCount})`}
            {f === 'available' && `${t('program.available')} (${programs.length - enrolledCount})`}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {filteredPrograms.map((program) => (
          <ProgramCard
            key={program.id}
            program={program}
            isPremium={profile?.subscription_tier === 'premium' || profile?.subscription_tier === 'pro'}
            onEnroll={() => enrollInProgram(program.id)}
            onContinue={() => program.enrollment && continueProgram(program.enrollment.id)}
            onDelete={(e) => program.enrollment && deleteEnrollment(program.enrollment.id, e)}
            isEnrolling={enrollingId === program.id}
          />
        ))}
      </div>

      {filteredPrograms.length === 0 && (
        <Card className="text-center py-12">
          <BookOpen className="w-12 h-12 text-dark-400 mx-auto mb-4" />
          <p className="text-dark-500 dark:text-dark-400">
            {filter === 'enrolled'
              ? t('program.no_enrollments')
              : t('program.no_available')}
          </p>
        </Card>
      )}
    </div>
  );
}

interface ProgramCardProps {
  program: ProgramWithEnrollment;
  isPremium: boolean;
  onEnroll: () => void;
  onContinue: () => void;
  onDelete: (e: React.MouseEvent) => void;
  isEnrolling: boolean;
}

function ProgramCard({ program, isPremium, onEnroll, onContinue, onDelete, isEnrolling }: ProgramCardProps) {
  const canAccess = true;
  const isEnrolled = !!program.enrollment;
  const isCompleted = !!program.enrollment?.completed_at;

  const getDifficultyColor = (difficulty: number): 'success' | 'warning' | 'error' | 'default' => {
    if (difficulty <= 2) return 'success';
    if (difficulty === 3) return 'warning';
    return 'error';
  };

  const getDifficultyLabel = (difficulty: number) => {
    if (difficulty <= 2) return t('program.difficulty.beginner');
    if (difficulty === 3) return t('program.difficulty.intermediate');
    return t('program.difficulty.advanced');
  };


  return (
    <Card
      className={`transition-all hover:shadow-lg ${
        !canAccess ? 'opacity-75' : ''
      } ${isCompleted ? 'border-green-500 border-2' : ''}`}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white">
              {t(program.name_key)}
            </h3>
            <Badge variant={getDifficultyColor(program.difficulty)}>
              {getDifficultyLabel(program.difficulty)}
            </Badge>
            {isCompleted && (
              <Badge variant="success">
                <CheckCircle className="w-3 h-3 mr-1" />
                {t('program.completed')}
              </Badge>
            )}
            {program.daily_minutes && (
              <Badge variant="secondary" size="sm">
                <Clock className="w-3 h-3 mr-1" />
                {program.daily_minutes} {t('training.daily_minutes')}
              </Badge>
            )}
          </div>

          <p className="text-dark-600 dark:text-dark-400 mb-3">
            {t(program.desc_key)}
          </p>

          <div className="flex flex-wrap gap-4 text-sm text-dark-500 dark:text-dark-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {program.duration_days} {t('program.day')}
            </span>
          </div>

          {isEnrolled && !isCompleted && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-dark-600 dark:text-dark-400">
                  {program.enrollment?.current_day}{t('program.current_day')}
                </span>
                <span className="font-medium text-primary-600">
                  {program.enrollment?.progress_pct}%
                </span>
              </div>
              <div className="h-2 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${program.enrollment?.progress_pct || 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex md:flex-col gap-2">
          {!canAccess ? (
            <Button
              variant="outline"
              leftIcon={<Lock className="w-4 h-4" />}
              disabled
            >
              {t('program.premium_required')}
            </Button>
          ) : isEnrolled ? (
            <>
              <Button
                variant="primary"
                leftIcon={isCompleted ? <Trophy className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                onClick={onContinue}
              >
                {isCompleted ? t('program.retry') : t('program.continue')}
              </Button>
              <Button
                variant="outline"
                leftIcon={<X className="w-4 h-4" />}
                onClick={onDelete}
                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
              >
                {t('common.delete')}
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              leftIcon={<BookOpen className="w-4 h-4" />}
              onClick={onEnroll}
              isLoading={isEnrolling}
            >
              {t('program.enroll')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
