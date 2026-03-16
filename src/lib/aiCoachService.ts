import { supabase } from './supabase';

export interface GameResultData {
  won: boolean;
  match_average: number;
  legs_won: number;
  legs_lost: number;
  game_mode: string;
  highest_checkout?: number;
  doubles_hit?: number;
  doubles_thrown?: number;
  triples_hit?: number;
  triples_thrown?: number;
  total_180s?: number;
  total_100_plus?: number;
  best_leg_average?: number;
  worst_leg_average?: number;
  first_nine_average?: number;
  checkout_attempts?: number;
  checkouts_hit?: number;
  duration_seconds?: number;
  leg_details?: LegDetail[];
}

export interface LegDetail {
  leg_number: number;
  won: boolean;
  average: number;
  darts: number;
  checkout_score?: number;
  highest_visit: number;
  visits_180: number;
  visits_100_plus: number;
  doubles_hit: number;
  doubles_thrown: number;
}

export interface TrainingResultData {
  drill_name: string;
  drill_category?: string;
  score: number;
  hit_rate: number;
  total_darts: number;
  duration_seconds: number;
  targets_hit?: number;
  targets_total?: number;
  best_streak?: number;
}

async function getValidToken(): Promise<string | null> {
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  if (session.expires_at && session.expires_at * 1000 < Date.now() + 10000) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed.session;
  }
  return session?.access_token ?? null;
}

export const aiCoachService = {
  async callAI(payload: Record<string, unknown>): Promise<{ message: string; conversation_id?: string } | null> {
    try {
      const token = await getValidToken();
      if (!token) return null;

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/groq-ai`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async triggerPostGame(gameResult: GameResultData): Promise<string | null> {
    const result = await this.callAI({
      action: 'game_result',
      game_result: gameResult,
      context: 'game',
    });
    return result?.message || null;
  },

  async triggerPostTraining(trainingResult: TrainingResultData): Promise<string | null> {
    const result = await this.callAI({
      action: 'training_result',
      training_result: trainingResult,
      context: 'training',
    });
    return result?.message || null;
  },

  async getUnreadInsightsCount(userId: string): Promise<number> {
    try {
      const { count } = await supabase
        .from('ai_insights')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      return count || 0;
    } catch {
      return 0;
    }
  },

  async markAllInsightsRead(userId: string): Promise<void> {
    await supabase
      .from('ai_insights')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
  },

  async getActiveConversationId(userId: string): Promise<string | null> {
    try {
      const { data } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.id || null;
    } catch {
      return null;
    }
  },
};
