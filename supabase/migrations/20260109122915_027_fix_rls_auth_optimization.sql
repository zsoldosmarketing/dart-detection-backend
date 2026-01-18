/*
  # Fix RLS Auth Function Optimization

  ## Performance Improvements
  
  1. **Auth RLS Initialization Optimization**
     - Update all RLS policies using `auth.uid()` to use `(select auth.uid())`
     - This prevents re-evaluation for each row, improving performance significantly
     - Affects: dart_throws, leg_statistics, match_statistics, player_statistics_summary,
       checkout_attempts, training_drill_statistics, double_statistics
*/

-- dart_throws policies (uses player_id)
DROP POLICY IF EXISTS "Users can view own dart throws" ON dart_throws;
CREATE POLICY "Users can view own dart throws"
  ON dart_throws FOR SELECT
  TO authenticated
  USING (player_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own dart throws" ON dart_throws;
CREATE POLICY "Users can insert own dart throws"
  ON dart_throws FOR INSERT
  TO authenticated
  WITH CHECK (player_id = (select auth.uid()));

-- leg_statistics policies (uses player_id)
DROP POLICY IF EXISTS "Users can view own leg stats" ON leg_statistics;
CREATE POLICY "Users can view own leg stats"
  ON leg_statistics FOR SELECT
  TO authenticated
  USING (player_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own leg stats" ON leg_statistics;
CREATE POLICY "Users can insert own leg stats"
  ON leg_statistics FOR INSERT
  TO authenticated
  WITH CHECK (player_id = (select auth.uid()));

-- match_statistics policies (uses player_id)
DROP POLICY IF EXISTS "Users can view own match stats" ON match_statistics;
CREATE POLICY "Users can view own match stats"
  ON match_statistics FOR SELECT
  TO authenticated
  USING (player_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own match stats" ON match_statistics;
CREATE POLICY "Users can insert own match stats"
  ON match_statistics FOR INSERT
  TO authenticated
  WITH CHECK (player_id = (select auth.uid()));

-- player_statistics_summary policies (uses player_id)
DROP POLICY IF EXISTS "Users can view own stats summary" ON player_statistics_summary;
CREATE POLICY "Users can view own stats summary"
  ON player_statistics_summary FOR SELECT
  TO authenticated
  USING (player_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own stats summary" ON player_statistics_summary;
CREATE POLICY "Users can insert own stats summary"
  ON player_statistics_summary FOR INSERT
  TO authenticated
  WITH CHECK (player_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own stats summary" ON player_statistics_summary;
CREATE POLICY "Users can update own stats summary"
  ON player_statistics_summary FOR UPDATE
  TO authenticated
  USING (player_id = (select auth.uid()))
  WITH CHECK (player_id = (select auth.uid()));

-- checkout_attempts policies (uses player_id)
DROP POLICY IF EXISTS "Users can view own checkout attempts" ON checkout_attempts;
CREATE POLICY "Users can view own checkout attempts"
  ON checkout_attempts FOR SELECT
  TO authenticated
  USING (player_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own checkout attempts" ON checkout_attempts;
CREATE POLICY "Users can insert own checkout attempts"
  ON checkout_attempts FOR INSERT
  TO authenticated
  WITH CHECK (player_id = (select auth.uid()));

-- training_drill_statistics policies (uses player_id)
DROP POLICY IF EXISTS "Users can view own training stats" ON training_drill_statistics;
CREATE POLICY "Users can view own training stats"
  ON training_drill_statistics FOR SELECT
  TO authenticated
  USING (player_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own training stats" ON training_drill_statistics;
CREATE POLICY "Users can insert own training stats"
  ON training_drill_statistics FOR INSERT
  TO authenticated
  WITH CHECK (player_id = (select auth.uid()));

-- double_statistics policies (uses player_id)
DROP POLICY IF EXISTS "Users can view own double stats" ON double_statistics;
CREATE POLICY "Users can view own double stats"
  ON double_statistics FOR SELECT
  TO authenticated
  USING (player_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can upsert own double stats" ON double_statistics;
CREATE POLICY "Users can upsert own double stats"
  ON double_statistics FOR INSERT
  TO authenticated
  WITH CHECK (player_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own double stats" ON double_statistics;
CREATE POLICY "Users can update own double stats"
  ON double_statistics FOR UPDATE
  TO authenticated
  USING (player_id = (select auth.uid()))
  WITH CHECK (player_id = (select auth.uid()));
