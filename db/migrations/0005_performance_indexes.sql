-- Performance indexes for TradeCore
-- trades(user_id, entry_at): serves all user-scoped date-range queries
--   (dashboard 90-day equity curve, analytics 30-day heatmap, monthly P&L)
--   user_id as leading column also serves plain WHERE user_id = X queries.
CREATE INDEX IF NOT EXISTS idx_trades_user_id_entry_at
  ON trades (user_id, entry_at);

-- rule_violations(user_id): used in compliance % query (WHERE user_id = X)
--   The existing (trade_id, rule_id) unique index does not cover user_id lookups.
CREATE INDEX IF NOT EXISTS idx_rule_violations_user_id
  ON rule_violations (user_id);

-- trade_screenshots(trade_id): used in JOIN/WHERE on trade detail page
CREATE INDEX IF NOT EXISTS idx_trade_screenshots_trade_id
  ON trade_screenshots (trade_id);
