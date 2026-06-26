-- ============================================================
-- TradeCore — Row Level Security policies
-- Run this ONCE against your Neon database after migrations.
-- Requires Supabase Auth (auth.uid() must be available).
--
-- Pattern: users can only read/write rows where user_id = their
-- Supabase auth UUID. This is enforced at the database level so
-- no application-layer bug can leak another user's data.
-- ============================================================

-- ── users ────────────────────────────────────────────────────
-- users.id IS the Supabase auth UUID (set on first sign-in)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON users;
CREATE POLICY "own rows only" ON users
  FOR ALL
  USING      (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

-- ── trades ───────────────────────────────────────────────────
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON trades;
CREATE POLICY "own rows only" ON trades
  FOR ALL
  USING      (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ── trade_screenshots ─────────────────────────────────────────
ALTER TABLE trade_screenshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON trade_screenshots;
CREATE POLICY "own rows only" ON trade_screenshots
  FOR ALL
  USING      (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ── emotion_logs ─────────────────────────────────────────────
ALTER TABLE emotion_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON emotion_logs;
CREATE POLICY "own rows only" ON emotion_logs
  FOR ALL
  USING      (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ── rules ────────────────────────────────────────────────────
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON rules;
CREATE POLICY "own rows only" ON rules
  FOR ALL
  USING      (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ── rule_violations ───────────────────────────────────────────
ALTER TABLE rule_violations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON rule_violations;
CREATE POLICY "own rows only" ON rule_violations
  FOR ALL
  USING      (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ── setup_tags ────────────────────────────────────────────────
ALTER TABLE setup_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON setup_tags;
CREATE POLICY "own rows only" ON setup_tags
  FOR ALL
  USING      (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ── stats_cache ───────────────────────────────────────────────
ALTER TABLE stats_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON stats_cache;
CREATE POLICY "own rows only" ON stats_cache
  FOR ALL
  USING      (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ── user_milestones ───────────────────────────────────────────
ALTER TABLE user_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON user_milestones;
CREATE POLICY "own rows only" ON user_milestones
  FOR ALL
  USING      (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ── weekly_summaries ─────────────────────────────────────────
ALTER TABLE weekly_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON weekly_summaries;
CREATE POLICY "own rows only" ON weekly_summaries
  FOR ALL
  USING      (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ── ai_context_cache ─────────────────────────────────────────
ALTER TABLE ai_context_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON ai_context_cache;
CREATE POLICY "own rows only" ON ai_context_cache
  FOR ALL
  USING      (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ── Confirm ──────────────────────────────────────────────────
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'users','trades','trade_screenshots','emotion_logs',
    'rules','rule_violations','setup_tags','stats_cache',
    'user_milestones','weekly_summaries','ai_context_cache'
  )
ORDER BY tablename;
