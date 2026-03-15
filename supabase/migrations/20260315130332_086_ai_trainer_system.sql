/*
  # AI Trainer System

  Teljes körű AI edző rendszer a DartsTraining platformhoz.

  ## Új táblák

  ### ai_conversations
  - AI chat beszélgetési szálak játékosonként

  ### ai_messages
  - Egyedi üzenetek a beszélgetésekben (role: user/assistant)

  ### ai_goals
  - Játékos személyes célkitűzések haladásmérővel

  ### ai_training_plans
  - AI által generált személyre szabott edzéstervek

  ### ai_insights
  - AI teljesítményelemzések és ajánlások

  ## Biztonság
  - Minden táblan RLS engedélyezve
  - Felhasználók csak saját adataikhoz férnek hozzá
*/

-- AI Conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text DEFAULT 'Új beszélgetés',
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON ai_conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON ai_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON ai_conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON ai_conversations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- AI Messages
CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES ai_conversations(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own conversations"
  ON ai_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ai_conversations
      WHERE ai_conversations.id = ai_messages.conversation_id
      AND ai_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in own conversations"
  ON ai_messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_conversations
      WHERE ai_conversations.id = ai_messages.conversation_id
      AND ai_conversations.user_id = auth.uid()
    )
  );

-- AI Goals
CREATE TABLE IF NOT EXISTS ai_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  goal_type text NOT NULL DEFAULT 'custom',
  target_value numeric DEFAULT 0,
  current_value numeric DEFAULT 0,
  unit text DEFAULT '',
  deadline date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE ai_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals"
  ON ai_goals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
  ON ai_goals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON ai_goals FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON ai_goals FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- AI Training Plans
CREATE TABLE IF NOT EXISTS ai_training_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  duration_days int DEFAULT 7,
  days jsonb DEFAULT '[]',
  focus_areas text[] DEFAULT '{}',
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_training_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own training plans"
  ON ai_training_plans FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own training plans"
  ON ai_training_plans FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own training plans"
  ON ai_training_plans FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own training plans"
  ON ai_training_plans FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- AI Insights
CREATE TABLE IF NOT EXISTS ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  insight_type text NOT NULL DEFAULT 'recommendation' CHECK (insight_type IN ('performance', 'recommendation', 'milestone', 'warning', 'tip')),
  title text NOT NULL,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights"
  ON ai_insights FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own insights"
  ON ai_insights FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own insights"
  ON ai_insights FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_last_message ON ai_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_goals_user_id ON ai_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_goals_status ON ai_goals(status);
CREATE INDEX IF NOT EXISTS idx_ai_training_plans_user_id ON ai_training_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_id ON ai_insights(user_id);

-- Insert default AI config keys
INSERT INTO app_config (key, value_json, type, description_key)
VALUES 
  ('groq_api_key', '""', 'string', 'Groq API kulcs'),
  ('groq_model', '"llama-3.3-70b-versatile"', 'string', 'Groq modell neve'),
  ('ai_system_prompt', '"Te egy profi darts edző és személyes trainer vagy a DartsTraining platformon. A neved DartsCoach AI. Mindig magyarul válaszolj. Légy meleg, professzionális és motiváló."', 'string', 'AI rendszerprompt'),
  ('ai_enabled', 'true', 'boolean', 'AI edző aktív'),
  ('ai_max_messages_per_day', '50', 'number', 'Max üzenetek naponta')
ON CONFLICT (key) DO NOTHING;
