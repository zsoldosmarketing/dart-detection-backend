import { useEffect, useState } from 'react';
import { BarChart3, CheckCircle2, PencilLine } from 'lucide-react';
import {
  getDetectionQualitySummary,
  type DetectionQualitySummary as DetectionQualitySummaryData,
} from '../../lib/detectionFeedback';

function percentage(value: number | null): string {
  return value === null ? '–' : `${Math.round(value * 100)}%`;
}

export function DetectionQualitySummary() {
  const [summary, setSummary] = useState<DetectionQualitySummaryData | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const nextSummary = await getDetectionQualitySummary();
      if (isMounted) setSummary(nextSummary);
    };

    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  if (!summary || summary.total === 0) return null;

  const acceptanceRate = summary.acceptanceRate ?? 0;
  const acceptanceTone = acceptanceRate >= 0.85
    ? 'text-emerald-300'
    : acceptanceRate >= 0.65
      ? 'text-amber-200'
      : 'text-rose-200';

  return (
    <div className="rounded-lg border border-dark-700/80 bg-dark-900/85 px-3 py-2 text-xs text-dark-200 backdrop-blur-sm">
      <div className="mb-1 flex items-center gap-1.5 text-dark-100">
        <BarChart3 className="h-3.5 w-3.5 text-primary-300" />
        <span className="font-semibold">Felismerési minőség</span>
        <span className="text-dark-400">az utolsó {summary.total} dobásból</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className={`font-bold ${acceptanceTone}`}>{percentage(summary.acceptanceRate)}</div>
          <div className="text-dark-400">elfogadva</div>
        </div>
        <div>
          <div className="flex items-center gap-1 font-bold text-amber-200">
            <PencilLine className="h-3 w-3" /> {summary.corrected}
          </div>
          <div className="text-dark-400">javítva</div>
        </div>
        <div>
          <div className="flex items-center gap-1 font-bold text-primary-200">
            <CheckCircle2 className="h-3 w-3" /> {percentage(summary.averageModelConfidence)}
          </div>
          <div className="text-dark-400">modellbizalom</div>
        </div>
      </div>
    </div>
  );
}
