import { pgTable, uuid, varchar, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./users";

export const setupTags = pgTable(
  "setup_tags",
  {
    id:     uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
              .notNull()
              .references(() => users.id, { onDelete: "cascade" }),

    /** e.g. "London breakout", "OB retest", "ICT killzone" */
    name: varchar("name", { length: 80 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /** Each user's setup tag names must be unique */
    unique("uq_setup_tag_user_name").on(table.userId, table.name),
  ]
);

export type SetupTag    = typeof setupTags.$inferSelect;
export type NewSetupTag = typeof setupTags.$inferInsert;
