import { pgTable, uuid, numeric, integer, varchar, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Denormalised stats snapshot for a user — recomputed by the
 * /api/internal/refresh-stats background job after every trade mutation.
 * One row per user (enforced by unique constraint on user_id).
 */
export const statsCache = pgTable(
  "stats_cache",
  {
    id:     uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
              .notNull()
              .references(() => users.id, { onDelete: "cascade" }),

    /** Win rate as percentage 0–100.00 */
    winRate:        numeric("win_rate",          { precision: 5,  scale: 2 }),
    /** Sum of all closed pnl_usd */
    totalPnl:       numeric("total_pnl",         { precision: 14, scale: 2 }),
    /** Average risk/reward ratio across closed trades */
    avgRr:          numeric("avg_rr",            { precision: 6,  scale: 3 }),

    totalTrades:    integer("total_trades").notNull().default(0),
    closedTrades:   integer("closed_trades").notNull().default(0),
    openTrades:     integer("open_trades").notNull().default(0),

    /** % of closed trades that have zero rule violations */
    ruleCompliancePct: numeric("rule_compliance_pct", { precision: 5, scale: 2 }),

    /**
     * Phantom P&L = totalPnl + absolute losses recovered from rule-violating trades.
     * "What you would have made if rule-breaking losses hadn't happened."
     */
    phantomPnl:    numeric("phantom_pnl",    { precision: 14, scale: 2 }),
    /** behavioralGap = phantomPnl − totalPnl (losses attributable to rule breaks) */
    behavioralGap: numeric("behavioral_gap", { precision: 14, scale: 2 }),

    /** setup_tag with highest win rate (minimum 3 trades to qualify) */
    bestSetup:     varchar("best_setup",     { length: 80 }),
    /** Session with the lowest win rate across closed trades */
    worstSession:  varchar("worst_session",  { length: 20 }),
    /** Session with the highest win rate across closed trades */
    bestSession:   varchar("best_session",   { length: 20 }),

    /** Consecutive days with 100% rule compliance */
    currentStreak: integer("current_streak").notNull().default(0),
    longestStreak: integer("longest_streak").notNull().default(0),

    /** Composite score: compliance×0.6 + winRate×0.4 (0–100, clamped) */
    disciplineScore: numeric("discipline_score", { precision: 5, scale: 2 }),

    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /** One stats row per user */
    unique("uq_stats_cache_user").on(table.userId),
  ]
);

export type StatsCache    = typeof statsCache.$inferSelect;
export type NewStatsCache = typeof statsCache.$inferInsert;
