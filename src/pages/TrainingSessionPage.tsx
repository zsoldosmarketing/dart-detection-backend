import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Trophy,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { DartScoreInput } from '../components/game/DartScoreInput';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { getScore, getCheckoutRoutes, getSetupSuggestions, isCheckout, isBust, formatDartDisplay, type DartTarget, type CheckoutRoute, type SetupSuggestion } from '../lib/dartsEngine';
import { soundEffects } from '../lib/soundEffects';
import type { Tables } from '../lib/supabase';

type DrillMode = 'target_hit' | 'checkout' | 'random_checkout';

interface DrillTargetState {
  target: string;
  requiredHits: number;
  currentHits: number;
  attempts: number;
}

interface CheckoutAttempt {
  targetScore: number;
  remaining: number;
  darts: DartTarget[];
  dartScores: number[];
  suggestedRoutes: CheckoutRoute[];
  setupSuggestions: SetupSuggestion[];
}

interface CheckoutStats {
  attempts: number;
  successes: number;
  totalDarts: number;
}

export function TrainingSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [session, setSession] = useState<Tables['training_sessions'] | null>(null);
  const [drill, setDrill] = useState<Tables['drills'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [targets, setTargets] = useState<DrillTargetState[]>([]);
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [totalDarts, setTotalDarts] = useState(0);
  const [startTime] = useState(Date.now());
  const [isComplete, setIsComplete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [dartQueue, setDartQueue] = useState<DartTarget[]>([]);

  const [drillMode, setDrillMode] = useState<DrillMode>('target_hit');
  const [checkoutAttempt, setCheckoutAttempt] = useState<CheckoutAttempt | null>(null);
  const [checkoutStats, setCheckoutStats] = useState<CheckoutStats>({ attempts: 0, successes: 0, totalDarts: 0 });
  const [checkoutConfig, setCheckoutConfig] = useState<{ score?: number; range?: [number, number]; maxAttempts: number }>({ maxAttempts: 10 });
  const [preferredDoubles, setPreferredDoubles] = useState<number[]>([20, 16, 8]);

  useEffect(() => {
    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  useEffect(() => {
    if (user) {
      loadPreferredDoubles();
    }
  }, [user]);

  const loadPreferredDoubles = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_profile')
      .select('preferred_doubles')
      .eq('id', user.id)
      .maybeSingle();

    if (data?.preferred_doubles) {
      setPreferredDoubles(data.preferred_doubles as unknown as number[]);
    }
  };

  const loadSession = async () => {
    if (!sessionId) return;

    const { data: sessionData } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionData) {
      setSession(sessionData);

      const { data: drillData } = await supabase
        .from('drills')
        .select('*')
        .eq('id', sessionData.drill_id)
        .single();

      if (drillData) {
        setDrill(drillData);
        initializeDrillTargets(drillData);
      }
    }

    setIsLoading(false);
  };

  const initializeDrillTargets = (drillData: Tables['drills']) => {
    const config = drillData.config as any;
    let drillTargets: DrillTargetState[] = [];

    if (config?.type === 'fixed_checkout') {
      setDrillMode('checkout');
      setCheckoutConfig({ score: config.score, maxAttempts: config.attempts || 10 });
      startNewCheckoutAttempt(config.score);
      return;
    }

    if (config?.type === 'random_checkout') {
      setDrillMode('random_checkout');
      setCheckoutConfig({ range: config.range || [40, 100], maxAttempts: config.attempts || 15 });
      const randomScore = generateRandomCheckout(config.range || [40, 100]);
      startNewCheckoutAttempt(randomScore);
      return;
    }

    setDrillMode('target_hit');

    if (config?.type === 'focus_drill') {
      if (config.target) {
        drillTargets = [{ target: config.target, requiredHits: config.required_hits || 20, currentHits: 0, attempts: 0 }];
      } else if (config.targets) {
        const hitsPerTarget = Math.floor((config.required_hits || 50) / config.targets.length);
        drillTargets = config.targets.map((target: string) => ({ target, requiredHits: hitsPerTarget, currentHits: 0, attempts: 0 }));
      }
    } else if (config?.type === 'sequence_drill') {
      drillTargets = config.targets.map((target: string) => ({ target, requiredHits: config.hits_per_target || 1, currentHits: 0, attempts: 0 }));
    } else if (config?.type === 'alternating_drill') {
      drillTargets = config.targets.map((target: string) => ({ target, requiredHits: config.hits_per_target || 10, currentHits: 0, attempts: 0 }));
    } else if (config?.type === 'mixed_drill') {
      drillTargets = config.targets.map((target: string) => ({ target, requiredHits: config.required_hits[target] || 10, currentHits: 0, attempts: 0 }));
    } else {
      drillTargets = [{ target: 'T20', requiredHits: 10, currentHits: 0, attempts: 0 }];
    }

    setTargets(drillTargets);
  };

  const generateRandomCheckout = (range: [number, number]): number => {
    const [min, max] = range;
    const bogeyNumbers = [169, 168, 166, 165, 163, 162, 159];
    let score: number;
    do {
      score = Math.floor(Math.random() * (max - min + 1)) + min;
    } while (bogeyNumbers.includes(score));
    return score;
  };

  const startNewCheckoutAttempt = (targetScore: number) => {
    const routes = getCheckoutRoutes(targetScore, preferredDoubles);
    const setup = getSetupSuggestions(targetScore, 3, preferredDoubles);
    setCheckoutAttempt({ targetScore, remaining: targetScore, darts: [], dartScores: [], suggestedRoutes: routes, setupSuggestions: setup });
  };

  const handleUndo = () => {
    if (dartQueue.length > 0) {
      setDartQueue(prev => prev.slice(0, -1));
    }
  };

  const handleDartThrow = useCallback((dartTarget: DartTarget) => {
    if (isComplete) return;

    const score = getScore(dartTarget);
    setTotalDarts((prev) => prev + 1);

    if (drillMode === 'checkout' || drillMode === 'random_checkout') {
      setCheckoutAttempt((currentAttempt) => {
        if (!currentAttempt) return currentAttempt;

        const newDarts = [...currentAttempt.darts, dartTarget];
        const newDartScores = [...currentAttempt.dartScores, score];
        const newRemaining = currentAttempt.remaining - score;

        if (isCheckout(currentAttempt.remaining, score, dartTarget)) {
          soundEffects.playCheckout();
          setMessage(t('training.checkout_success'));
          setTimeout(() => setMessage(null), 1000);

          setCheckoutStats((prevStats) => {
            const newStats = { attempts: prevStats.attempts + 1, successes: prevStats.successes + 1, totalDarts: prevStats.totalDarts + newDarts.length };
            if (newStats.attempts >= checkoutConfig.maxAttempts) {
              setTimeout(() => completeSession(), 100);
            } else {
              setTimeout(() => {
                if (drillMode === 'random_checkout' && checkoutConfig.range) {
                  startNewCheckoutAttempt(generateRandomCheckout(checkoutConfig.range));
                } else if (checkoutConfig.score) {
                  startNewCheckoutAttempt(checkoutConfig.score);
                }
              }, 1200);
            }
            return newStats;
          });

          setTotalScore(prev => prev + currentAttempt.targetScore);
          return currentAttempt;
        }

        if (isBust(currentAttempt.remaining, score, dartTarget) || newDarts.length >= 3) {
          setMessage(newRemaining < 0 || newRemaining === 1 ? t('training.bust') : t('training.no_checkout'));
          setTimeout(() => setMessage(null), 800);

          setCheckoutStats((prevStats) => {
            const newStats = { attempts: prevStats.attempts + 1, successes: prevStats.successes, totalDarts: prevStats.totalDarts + newDarts.length };
            if (newStats.attempts >= checkoutConfig.maxAttempts) {
              setTimeout(() => completeSession(), 100);
            } else {
              setTimeout(() => {
                if (drillMode === 'random_checkout' && checkoutConfig.range) {
                  startNewCheckoutAttempt(generateRandomCheckout(checkoutConfig.range));
                } else if (checkoutConfig.score) {
                  startNewCheckoutAttempt(checkoutConfig.score);
                }
              }, 1000);
            }
            return newStats;
          });
          return currentAttempt;
        }

        const updatedRoutes = getCheckoutRoutes(newRemaining, preferredDoubles);
        const updatedSetup = getSetupSuggestions(newRemaining, 3, preferredDoubles);
        return { ...currentAttempt, remaining: newRemaining, darts: newDarts, dartScores: newDartScores, suggestedRoutes: updatedRoutes, setupSuggestions: updatedSetup };
      });
      return;
    }

    if (targets.length === 0) return;

    const currentTarget = targets[currentTargetIndex];
    const isHit = dartTarget === currentTarget.target;

    setTotalScore((prev) => prev + score);

    const updatedTargets = [...targets];
    updatedTargets[currentTargetIndex] = { ...currentTarget, currentHits: isHit ? currentTarget.currentHits + 1 : currentTarget.currentHits, attempts: currentTarget.attempts + 1 };
    setTargets(updatedTargets);

    if (isHit) {
      setMessage(t('training.hit'));
      setTimeout(() => setMessage(null), 500);
    }

    if (updatedTargets[currentTargetIndex].currentHits >= currentTarget.requiredHits) {
      soundEffects.playCheckout();
      if (currentTargetIndex < targets.length - 1) {
        setCurrentTargetIndex((prev) => prev + 1);
        setMessage(t('training.next_target'));
        setTimeout(() => setMessage(null), 800);
      } else {
        completeSession();
      }
    }
  }, [targets, currentTargetIndex, isComplete, drillMode, checkoutConfig]);

  const handleSubmit = useCallback(() => {
    if (dartQueue.length === 0) return;
    dartQueue.forEach(dart => handleDartThrow(dart));
    setDartQueue([]);
  }, [dartQueue, handleDartThrow]);

  const completeSession = async () => {
    soundEffects.playCheckout();
    setIsComplete(true);
    setMessage(t('training.session_complete'));

    if (session && drill) {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      let hitRate: number;
      let finalScore: number;
      let finalDarts: number;

      if (drillMode === 'checkout' || drillMode === 'random_checkout') {
        hitRate = checkoutStats.attempts > 0 ? (checkoutStats.successes / checkoutStats.attempts) * 100 : 0;
        finalScore = totalScore;
        finalDarts = checkoutStats.totalDarts;
      } else {
        const totalHits = targets.reduce((sum, t) => sum + t.currentHits, 0);
        const totalAttempts = targets.reduce((sum, t) => sum + t.attempts, 0);
        hitRate = totalAttempts > 0 ? (totalHits / totalAttempts) * 100 : 0;
        finalScore = totalScore;
        finalDarts = totalDarts;
      }

      const { error } = await supabase
        .from('training_sessions')
        .update({
          status: 'completed',
          total_score: finalScore,
          total_darts: finalDarts,
          duration_seconds: duration,
          hit_rate: hitRate,
          completed_at: new Date().toISOString()
        })
        .eq('id', session.id);

      if (error) {
        console.error('Failed to complete session:', error);
      }
    }

    setTimeout(() => {
      navigate('/training');
    }, 4000);
  };

  const addToQueue = (target: DartTarget) => {
    if (dartQueue.length < 3) {
      soundEffects.playDartImpact();
      setDartQueue(prev => [...prev, target]);
    }
  };

  const currentTarget = targets[currentTargetIndex];
  const progress = drillMode === 'checkout' || drillMode === 'random_checkout'
    ? Math.round((checkoutStats.attempts / checkoutConfig.maxAttempts) * 100)
    : targets.length > 0
      ? Math.round((currentTargetIndex / targets.length) * 100 + (currentTarget?.currentHits || 0) / (currentTarget?.requiredHits || 1) * (100 / targets.length))
      : 0;

  const queuedScore = dartQueue.reduce((sum, dart) => sum + getScore(dart), 0);
  const displayRemaining = checkoutAttempt ? checkoutAttempt.remaining - queuedScore : 0;
  const displayRoutes = checkoutAttempt && dartQueue.length > 0 ? getCheckoutRoutes(displayRemaining, preferredDoubles) : checkoutAttempt?.suggestedRoutes || [];
  const displaySetup = checkoutAttempt && dartQueue.length > 0 ? getSetupSuggestions(displayRemaining, 3, preferredDoubles) : checkoutAttempt?.setupSuggestions || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!drill) {
    return (
      <div className="text-center py-12">
        <p className="text-dark-500">{t('training.practice_not_found')}</p>
        <Button onClick={() => navigate('/training')} className="mt-4">{t('common.back')}</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <Button variant="ghost" leftIcon={<ChevronLeft className="w-4 h-4" />} onClick={() => navigate('/training')}>{t('common.back')}</Button>
        <Badge variant="primary">{drill.category}</Badge>
      </div>

      {message && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 pointer-events-none">
          <div className="bg-white dark:bg-dark-800 rounded-2xl p-8 text-center animate-scale-in">
            <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">{message}</div>
          </div>
        </div>
      )}

      {isComplete ? (
        <Card className="text-center py-6">
          <Trophy className="w-12 h-12 text-warning-500 mx-auto mb-3" />
          <h3 className="text-xl font-bold text-dark-900 dark:text-white mb-2">{t('training.session_complete')}</h3>
          <p className="text-sm text-dark-500 dark:text-dark-400 mb-4">{t('training.auto_redirect')}</p>
          {(drillMode === 'checkout' || drillMode === 'random_checkout') ? (
            <div className="grid grid-cols-2 gap-3 mt-4 max-w-xs mx-auto">
              <div className="p-3 rounded-lg bg-dark-100 dark:bg-dark-700">
                <p className="text-xl font-bold text-primary-600">{checkoutStats.successes}/{checkoutStats.attempts}</p>
                <p className="text-xs text-dark-500">{t('training.checkouts')}</p>
              </div>
              <div className="p-3 rounded-lg bg-dark-100 dark:bg-dark-700">
                <p className="text-xl font-bold text-secondary-600">{checkoutStats.attempts > 0 ? Math.round((checkoutStats.successes / checkoutStats.attempts) * 100) : 0}%</p>
                <p className="text-xs text-dark-500">{t('training.success_rate')}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 mt-4 max-w-xs mx-auto">
              <div className="p-3 rounded-lg bg-dark-100 dark:bg-dark-700">
                <p className="text-xl font-bold text-primary-600">{totalScore}</p>
                <p className="text-xs text-dark-500">{t('training.total_points')}</p>
              </div>
              <div className="p-3 rounded-lg bg-dark-100 dark:bg-dark-700">
                <p className="text-xl font-bold text-secondary-600">{targets.reduce((sum, t) => sum + t.attempts, 0) > 0 ? Math.round((targets.reduce((sum, t) => sum + t.currentHits, 0) / targets.reduce((sum, t) => sum + t.attempts, 0)) * 100) : 0}%</p>
                <p className="text-xs text-dark-500">{t('training.hit_rate')}</p>
              </div>
            </div>
          )}
          <Button className="mt-4" onClick={() => navigate('/training')}>{t('training.back_to_training')}</Button>
        </Card>
      ) : (
        <>
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-dark-500">{t(drill.name_key)}</span>
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                {(drillMode === 'checkout' || drillMode === 'random_checkout') ? (
                  <>
                    <div><span className="font-bold text-dark-900 dark:text-white">{checkoutStats.successes}</span><span className="text-dark-400 ml-1">OK</span></div>
                    <div><span className="font-bold text-dark-900 dark:text-white">{checkoutStats.attempts}</span><span className="text-dark-400 ml-1">/{checkoutConfig.maxAttempts}</span></div>
                    <div><span className="font-bold text-dark-900 dark:text-white">{checkoutStats.attempts > 0 ? Math.round((checkoutStats.successes / checkoutStats.attempts) * 100) : 0}%</span></div>
                  </>
                ) : (
                  <>
                    <div><span className="font-bold text-dark-900 dark:text-white">{totalScore}</span><span className="text-dark-400 ml-1">pt</span></div>
                    <div><span className="font-bold text-dark-900 dark:text-white">{totalDarts}</span><span className="text-dark-400 ml-1">db</span></div>
                    <div><span className="font-bold text-dark-900 dark:text-white">{targets.reduce((sum, t) => sum + t.currentHits, 0)}</span><span className="text-dark-400 ml-1">hit</span></div>
                  </>
                )}
              </div>
            </div>
            <div className="h-1.5 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 transition-all duration-300" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
          </Card>

          <Card className="text-center p-2">
            {(drillMode === 'checkout' || drillMode === 'random_checkout') && checkoutAttempt ? (
              <>
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-3">
                  <span className="text-4xl font-bold text-primary-600 dark:text-primary-400">{displayRemaining}</span>
                </div>

                {displaySetup.length > 0 && (
                  <div className="mb-3 p-2.5 rounded-lg bg-warning-100 dark:bg-warning-900/20 border-2 border-warning-500">
                    <p className="text-sm font-bold text-warning-700 dark:text-warning-400 mb-2">{t('training.setup_required')}</p>
                    {displaySetup.slice(0, 2).map((setup, idx) => (
                      <div key={idx} className={`px-3 py-2 rounded text-sm font-bold mb-1 ${idx === 0 ? 'bg-warning-500 text-white' : 'bg-dark-200 dark:bg-dark-600 text-dark-900 dark:text-dark-100'}`}>
                        {formatDartDisplay(setup.target)} → {setup.leave}
                      </div>
                    ))}
                  </div>
                )}

                {displayRoutes.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-dark-600 dark:text-dark-400 mb-2">{t('training.suggested_routes')}:</p>
                    {displayRoutes.slice(0, 1).map((route, idx) => (
                      <div key={idx} className="px-4 py-3 rounded-lg bg-primary-500 text-white text-base font-bold">
                        {route.darts.map(d => formatDartDisplay(d)).join(' → ')}
                        {route.salvage && <span className="text-sm block opacity-90 mt-1 font-medium">{route.salvage.replace(/S(\d+)/g, '$1')}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : currentTarget && (
              <>
                <p className="text-xs text-dark-500 mb-1">{t('training.next_target')}:</p>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-2">
                  <span className="text-3xl font-bold text-primary-600 dark:text-primary-400">{currentTarget.target}</span>
                </div>
                <div className="flex items-center justify-center gap-0.5 mb-1">
                  {Array.from({ length: Math.min(currentTarget.requiredHits, 20) }).map((_, i) => (
                    <div key={i} className={`w-2 h-2 rounded-full ${i < currentTarget.currentHits ? 'bg-success-500' : 'bg-dark-300 dark:bg-dark-600'}`} />
                  ))}
                </div>
                <p className="text-xs text-dark-500">{currentTarget.currentHits} / {currentTarget.requiredHits}</p>
              </>
            )}
          </Card>

          <DartScoreInput
            onThrow={addToQueue}
            onUndo={handleUndo}
            onSubmit={handleSubmit}
            currentDarts={[]}
            queuedDarts={dartQueue}
            thrownScore={0}
            queuedScore={queuedScore}
            isProcessing={false}
            canSubmit={dartQueue.length > 0}
            disabled={isComplete || dartQueue.length >= 3}
            autoStart={!isComplete}
          />
        </>
      )}
    </div>
  );
}
