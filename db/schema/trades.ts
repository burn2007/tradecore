import {
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const trades = pgTable(
  "trades",
  {
    id:     uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
              .notNull()
              .references(() => users.id, { onDelete: "cascade" }),

    /** Instrument: EURUSD, XAUUSD, BTCUSDT, NAS100, etc. */
    symbol:   varchar("symbol",   { length: 20  }).notNull(),

    /** long | short */
    direction:varchar("direction",{ length: 5   }).notNull(),

    entryPrice: numeric("entry_price", { precision: 18, scale: 8 }),
    exitPrice:  numeric("exit_price",  { precision: 18, scale: 8 }),

    /** Volume in standard lots */
    sizeLots: numeric("size_lots", { precision: 14, scale: 4 }),

    /** Realised profit / loss in USD — null while trade is open */
    pnlUsd:     numeric("pnl_usd",    { precision: 14, scale: 2 }),
    commission: numeric("commission", { precision: 10, scale: 4 }),
    swap:       numeric("swap",       { precision: 10, scale: 4 }),

    stopLoss:   numeric("stop_loss",   { precision: 18, scale: 8 }),
    takeProfit: numeric("take_profit", { precision: 18, scale: 8 }),

    /** Auto-detected from entry_at UTC hour: london | newyork | asian | african */
    session: varchar("session", { length: 20 }),

    /** User-defined setup label, e.g. "London breakout", "OB retest" */
    setupTag: varchar("setup_tag", { length: 80 }),

    /** Name of signal provider or Telegram channel if trade came from one */
    signalSource: varchar("signal_source", { length: 100 }),

    /** Trade origin: manual | csv | mt5 | binance | bybit */
    source: varchar("source", { length: 20 }).notNull(),

    /**
     * Broker ticket number — used for deduplication on CSV/API import.
     * Composite unique constraint (user_id, broker_trade_id) is defined below.
     */
    brokerTradeId: varchar("broker_trade_id", { length: 60 }),

    isPaperTrade: boolean("is_paper_trade").notNull().default(false),

    entryAt: timestamp("entry_at", { withTimezone: true }).notNull(),
    exitAt:  timestamp("exit_at",  { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * Prevents duplicate imports when the same broker ticket is imported twice.
     * NULL broker_trade_id values are excluded from uniqueness checks by Postgres.
     */
    unique("uq_trade_user_broker").on(table.userId, table.brokerTradeId),
  ]
);

export type Trade    = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;
