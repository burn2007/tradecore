import { pgTable, uuid, text, varchar, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Per-user AI context cache for Premium tier behavioural coaching.
 * All columns are nullable — populated only when AI features are active.
 * One row per user (enforced by unique constraint on user_id).
 */
export const aiContextCache = pgTable(
  "ai_context_cache",
  {
    id:     uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
              .notNull()
              .references(() => users.id, { onDelete: "cascade" }),

    /**
     * AI-written tilt analysis, e.g.
     * "You tend to overtrade during the London session after a loss."
     * — populated by Premium AI job, empty on free/pro
     */
    tiltSummary:     text("tilt_summary"),

    /**
     * Longer behavioural pattern notes written by the AI coaching model.
     * — populated by Premium AI job
     */
    behavioralNotes: text("behavioral_notes"),

    /**
     * SHA-256 hash of the trade data used to generate the current analysis.
     * Used to skip recomputation when trade data hasn't changed.
     */
    contextHash: varchar("context_hash", { length: 64 }),

    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /** One AI context record per user */
    unique("uq_ai_context_user").on(table.userId),
  ]
);

export type AiContextCache    = typeof aiContextCache.$inferSelect;
export type NewAiContextCache = typeof aiContextCache.$inferInsert;
