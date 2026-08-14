import type { DartTarget } from './dartsEngine';
import type { AutoCalibrationResult, ThrowScoreResult } from './dartDetectionApi';
import { supabase } from './supabase';

export type DetectionFeedbackType = 'accepted' | 'corrected' | 'rejected' | 'retry';

export interface DetectionFeedbackEvent {
  feedbackType: DetectionFeedbackType;
  result: ThrowScoreResult;
  calibration: AutoCalibrationResult | null;
  resolvedTarget?: DartTarget;
  deviceKind?: 'local' | 'remote';
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
