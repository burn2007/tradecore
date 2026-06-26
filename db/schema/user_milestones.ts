import { pgTable, uuid, varchar, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Gamification milestones. Once a milestone is achieved it is never removed.
 *
 * Known milestone_key values:
 *   first_trade, 10_trades, 50_trades, 100_trades,
 *   first_win, 3_day_streak, 7_day_streak, 30_day_streak,
 *   first_screenshot, first_rule, no_violations_week
 */
export const userMilestones = pgTable(
  "user_milestones",
  {
    id:     uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
              .notNull()
              .references(() => users.id, { onDelete: "cascade" }),

    milestoneKey: varchar("milestone_key", { length: 60 }).notNull(),

    achievedAt: timestamp("achieved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /** Each milestone can only be achieved once per user */
    unique("uq_milestone_user_key").on(table.userId, table.milestoneKey),
  ]
);

export type UserMilestone    = typeof userMilestones.$inferSelect;
export type NewUserMilestone = typeof userMilestones.$inferInsert;
