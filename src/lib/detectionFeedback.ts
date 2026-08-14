import type { DartTarget } from './dartsEngine';
import type { AutoCalibrationResult, ThrowScoreResult } from './dartDetectionApi';
import { supabase } from './supabase';

export type DetectionFeedbackType = 'accepted' | 'corrected' | 'rejected' | 'retry';

export interface DetectionQualitySummary {
  total: number;
  accepted: number;
  corrected: number;
  rejected: number;
  retried: number;
  acceptanceRate: number | null;
  averageModelConfidence: number | null;
}

export interface DetectionFeedbackEvent {
  feedbackType: DetectionFeedbackType;
  result: ThrowScoreResult;
  calibration: AutoCalibrationResult | null;
  resolvedTarget?: DartTarget;
  deviceKind?: 'local' | 'remote';
}

export async function getDetectionQualitySummary(limit = 100): Promise<DetectionQualitySummary> {
  const empty: DetectionQualitySummary = {
    total: 0,
    accepted: 0,
    corrected: 0,
    rejected: 0,
    retried: 0,
    acceptanceRate: null,
    averageModelConfidence: null,
  };

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return empty;

    const { data, error } = await supabase
      .from('dart_detection_feedback')
      .select('feedback_type, model_confidence')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Math.min(limit, 500)));

    if (error) throw error;
    const rows = data ?? [];
    const counts = rows.reduce((summary, row) => {
      if (row.feedback_type === 'accepted') summary.accepted++;
      if (row.feedback_type === 'corrected') summary.corrected++;
      if (row.feedback_type === 'rejected') summary.rejected++;
      if (row.feedback_type === 'retry') summary.retried++;
      return summary;
    }, { ...empty });
    const decisive = counts.accepted + counts.corrected + counts.rejected;
    const confidences = rows
      .map(row => row.model_confidence)
      .filter((confidence): confidence is number => typeof confidence === 'number');

    return {
      ...counts,
      total: rows.length,
      acceptanceRate: decisive > 0 ? counts.accepted / decisive : null,
      averageModelConfidence: confidences.length > 0
        ? confidences.reduce((total, confidence) => total + confidence, 0) / confidences.length
        : null,
    };
  } catch (error) {
    console.warn('[Detection feedback] Summary unavailable:', error);
    return empty;
  }
}

export async function recordDetectionFeedback(event: DetectionFeedbackEvent): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('dart_detection_feedback').insert({
      user_id: user.id,
      feedback_type: event.feedbackType,
      predicted_target: event.result.label || null,
      resolved_target: event.resolvedTarget ?? null,
      model_confidence: event.result.confidence ?? null,
      calibration_confidence: event.calibration?.confidence ?? null,
      calibration_method: event.calibration?.method ?? null,
      scoring_method: event.result.scoring_method ?? null,
      frame_change_quality: event.result.frame_change_quality ?? null,
      device_kind: event.deviceKind ?? null,
    });

    if (error) throw error;
  } catch (error) {
    console.warn('[Detection feedback] Not recorded:', error);
  }
}
