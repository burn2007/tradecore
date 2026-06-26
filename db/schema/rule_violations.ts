import { pgTable, uuid, timestamp, unique } from "drizzle-orm/pg-core";
import { users }  from "./users";
import { trades } from "./trades";
import { rules }  from "./rules";

export const ruleViolations = pgTable(
  "rule_violations",
  {
    id:      uuid("id").primaryKey().defaultRandom(),
    tradeId: uuid("trade_id")
               .notNull()
               .references(() => trades.id, { onDelete: "cascade" }),
    ruleId:  uuid("rule_id")
               .notNull()
               .references(() => rules.id,  { onDelete: "cascade" }),
    userId:  uuid("user_id")
               .notNull()
               .references(() => users.id,  { onDelete: "cascade" }),

    violatedAt: timestamp("violated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /** A rule can only be violated once per trade */
    unique("uq_violation_trade_rule").on(table.tradeId, table.ruleId),
  ]
);

export type RuleViolation    = typeof ruleViolations.$inferSelect;
export type NewRuleViolation = typeof ruleViolations.$inferInsert;
