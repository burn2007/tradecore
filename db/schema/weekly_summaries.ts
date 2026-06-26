import { pgTable, uuid, numeric, integer, text, date, timestamp, unique } from "drizzle-orm/pg-core";
import { users }  from "./users";
import { trades } from "./trades";

/**
 * Pre-computed weekly performance summary.
 * Generated every Monday by a background job.
 * The ai_narrative column is reserved for Premium tier AI coaching.
 */
export const weeklySummaries = pgTable(
  "weekly_summaries",
  {
    id:     uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
              .notNull()
              .references(() => users.id, { onDelete: "cascade" }),

    /** ISO date of the Monday that starts this week, e.g. "2025-01-06" */
    weekStart: date("week_start").notNull(),

    totalPnl:          numeric("total_pnl",           { precision: 14, scale: 2 }),
    winRate:           numeric("win_rate",             { precision: 5,  scale: 2 }),
    totalTrades:       integer("total_trades").notNull().default(0),
    ruleCompliancePct: numeric("rule_compliance_pct",  { precision: 5,  scale: 2 }),

    /** FK to the single best trade of the week by pnl_usd */
    bestTradeId:  uuid("best_trade_id").references(() => trades.id),
    /** FK to the single worst trade of the week by pnl_usd */
    worstTradeId: uuid("worst_trade_id").references(() => trades.id),

    /** Reserved for Premium AI narrative coaching (empty on free/pro tier) */
    aiNarrative: text("ai_narrative"),

    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /** Only one summary per user per week */
    unique("uq_weekly_summary_user_week").on(table.userId, table.weekStart),
  ]
);

export type WeeklySummary    = typeof weeklySummaries.$inferSelect;
export type NewWeeklySummary = typeof weeklySummaries.$inferInsert;
