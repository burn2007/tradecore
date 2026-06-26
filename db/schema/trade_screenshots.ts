import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { users }  from "./users";
import { trades } from "./trades";

export const tradeScreenshots = pgTable("trade_screenshots", {
  id:      uuid("id").primaryKey().defaultRandom(),
  tradeId: uuid("trade_id")
             .notNull()
             .references(() => trades.id, { onDelete: "cascade" }),
  userId:  uuid("user_id")
             .notNull()
             .references(() => users.id,  { onDelete: "cascade" }),

  /** Cloudflare R2 object key, e.g. "screenshots/user-id/trade-id/chart.png" */
  r2Key: text("r2_key").notNull(),

  /** Public CDN URL served from R2 */
  r2Url: text("r2_url").notNull(),

  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TradeScreenshot    = typeof tradeScreenshots.$inferSelect;
export type NewTradeScreenshot = typeof tradeScreenshots.$inferInsert;
