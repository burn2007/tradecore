import { pgTable, uuid, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { users }  from "./users";
import { trades } from "./trades";

/**
 * One emotion log per trade (enforced by unique constraint on trade_id).
 *
 * Mood scale:
 *   1 = Anxious / Devastated
 *   2 = Cautious
 *   3 = Neutral
 *   4 = Confident / Satisfied
 *   5 = Euphoric / Disciplined
 */
export const emotionLogs = pgTable(
  "emotion_logs",
  {
    id:      uuid("id").primaryKey().defaultRandom(),
    tradeId: uuid("trade_id")
               .notNull()
               .references(() => trades.id, { onDelete: "cascade" }),
    userId:  uuid("user_id")
               .notNull()
               .references(() => users.id,  { onDelete: "cascade" }),

    /** Emotional state before entering the trade (1–5) */
    preMood:  integer("pre_mood"),
    /** Emotional state after closing the trade (1–5) */
    postMood: integer("post_mood"),

    /** Free-text reflection written before entry */
    preNote:  text("pre_note"),
    /** Free-text reflection written after close */
    postNote: text("post_note"),

    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /** Enforce one emotion log per trade */
    unique("uq_emotion_log_trade").on(table.tradeId),
  ]
);

export type EmotionLog    = typeof emotionLogs.$inferSelect;
export type NewEmotionLog = typeof emotionLogs.$inferInsert;
