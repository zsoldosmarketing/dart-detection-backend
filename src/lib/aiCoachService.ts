import { supabase } from './supabase';

export interface GameResultData {
  won: boolean;
  match_average: number;
  legs_won: number;
  legs_lost: number;
  game_mode: string;
  highest_checkout?: number;
}

export interface TrainingResultData {
  drill_name: string;
  score: number;
  hit_rate: number;
  total_darts: number;
  duration_seconds: number;
}

async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : null;
}

export const aiCoachService = {
  async callAI(payload: Record<string, unknown>): Promise<{ message: string; conversation_id?: string } | null> {
    try {
      const authHeader = await getAuthHeader();
      if (!authHeader) return null;

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/groq-ai`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
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
