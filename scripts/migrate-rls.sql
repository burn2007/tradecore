-- ============================================================
-- TradeCore: Row-Level Security migration
-- Run as neondb_owner (or superuser) against the Neon database.
-- Safe to re-run: all statements use IF NOT EXISTS / IF EXISTS.
-- ============================================================

-- 1. Create restricted application role (no BYPASSRLS, no LOGIN needed
--    when using connection-string auth via pooler, but set NOINHERIT
--    so it cannot escalate via group membership).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tradecore_app') THEN
    CREATE ROLE tradecore_app NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- 2. Grant schema and sequence access
GRANT USAGE ON SCHEMA public TO tradecore_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO tradecore_app;

-- 3. Grant table permissions (SELECT/INSERT/UPDATE/DELETE only — no DDL)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  trades,
  emotion_logs,
  rule_violations,
  rules,
  setup_tags,
  stats_cache,
  user_milestones,
  trade_screenshots,
  users
TO tradecore_app;

-- 4. Future tables inherit permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tradecore_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO tradecore_app;

-- ============================================================
-- 5. Enable RLS on all user-scoped tables
-- ============================================================

ALTER TABLE trades             ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotion_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_violations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules              ENABLE ROW LEVEL SECURITY;
ALTER TABLE setup_tags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_cache        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_milestones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_screenshots  ENABLE ROW LEVEL SECURITY;

-- users table: RLS enabled but policy uses id (not user_id column)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. Create isolation policies (drop first so re-runs are safe)
-- ============================================================

-- trades
DROP POLICY IF EXISTS user_isolation ON trades;
CREATE POLICY user_isolation ON trades
  FOR ALL
  TO tradecore_app
  USING      (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

-- emotion_logs
DROP POLICY IF EXISTS user_isolation ON emotion_logs;
CREATE POLICY user_isolation ON emotion_logs
  FOR ALL
  TO tradecore_app
  USING      (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

-- rule_violations
DROP POLICY IF EXISTS user_isolation ON rule_violations;
CREATE POLICY user_isolation ON rule_violations
  FOR ALL
  TO tradecore_app
  USING      (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

-- rules
DROP POLICY IF EXISTS user_isolation ON rules;
CREATE POLICY user_isolation ON rules
  FOR ALL
  TO tradecore_app
  USING      (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

-- setup_tags
DROP POLICY IF EXISTS user_isolation ON setup_tags;
CREATE POLICY user_isolation ON setup_tags
  FOR ALL
  TO tradecore_app
  USING      (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

-- stats_cache
DROP POLICY IF EXISTS user_isolation ON stats_cache;
CREATE POLICY user_isolation ON stats_cache
  FOR ALL
  TO tradecore_app
  USING      (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

-- user_milestones
DROP POLICY IF EXISTS user_isolation ON user_milestones;
CREATE POLICY user_isolation ON user_milestones
  FOR ALL
  TO tradecore_app
  USING      (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

-- trade_screenshots
DROP POLICY IF EXISTS user_isolation ON trade_screenshots;
CREATE POLICY user_isolation ON trade_screenshots
  FOR ALL
  TO tradecore_app
  USING      (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

-- users: policy matches on id (the PK, which is the user's own id)
DROP POLICY IF EXISTS user_isolation ON users;
CREATE POLICY user_isolation ON users
  FOR ALL
  TO tradecore_app
  USING      (id::text = current_setting('app.current_user_id', true))
  WITH CHECK (id::text = current_setting('app.current_user_id', true));

-- ============================================================
-- 7. neondb_owner retains BYPASSRLS — no change needed.
--    admin_audit_log is intentionally excluded (adminUserId is
--    the admin who performed the action, not the row owner).
-- ============================================================

-- Verify: list all policies created
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname = 'user_isolation'
ORDER BY tablename;
