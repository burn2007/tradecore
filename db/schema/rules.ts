import { pgTable, uuid, varchar, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const rules = pgTable("rules", {
  id:     uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),

  /** e.g. "Never trade during red folder news", "Max 2% risk per trade" */
  title:       varchar("title",      { length: 200 }).notNull(),
  description: text("description"),

  isActive:  boolean("is_active").notNull().default(true),

  /** User-defined display order — lower value = displayed first */
  sortOrder: integer("sort_order").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Rule    = typeof rules.$inferSelect;
export type NewRule = typeof rules.$inferInsert;
