import { pgTable, uuid, varchar, text, boolean, timestamp, type AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Core user record. `id` must be set to the Supabase auth.uid() UUID on
 * first sign-in so that all FK relationships and RLS predicates resolve.
 */
export const users = pgTable("users", {
  id:               uuid("id").primaryKey().defaultRandom(),
  email:            varchar("email",             { length: 255 }).notNull().unique(),
  displayName:      varchar("display_name",      { length: 100 }),
  avatarUrl:        text("avatar_url"),

  /** Subscription tier — free | pro | premium */
  tier:             varchar("tier",              { length: 20  }).notNull().default("free"),

  /** Authorization role — user | admin */
  role:             varchar("role",              { length: 20  }).notNull().default("user"),

  /** P&L display currency: NGN | GHS | KES | ZAR | USD | EUR | GBP */
  preferredCurrency:varchar("preferred_currency",{ length: 10  }).notNull().default("USD"),

  timezone:         varchar("timezone",          { length: 50  }).notNull().default("UTC"),

  /** Populated when Pro subscription is activated */
  stripeCustomerId: varchar("stripe_customer_id",{ length: 60  }),

  // ── Onboarding fields ────────────────────────────────────────────────────
  /** Set to true after the user completes the first-run onboarding screen */
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),

  /**
   * Markets the user actively trades, e.g. ['forex', 'crypto', 'indices'].
   * Set during onboarding; nullable so schema is backwards-compatible.
   */
  marketsTraded: text("markets_traded").array(),

  /** Broker or exchange name (free text), e.g. "ICMarkets", "Binance" */
  broker: varchar("broker", { length: 100 }),

  // ── Soft-delete fields ───────────────────────────────────────────────────
  /**
   * Non-null means the account is in the reserve (soft-deleted).
   * Null means the account is active.
   * Always filter WHERE deleted_at IS NULL in normal user-facing and admin list
   * queries so soft-deleted accounts are invisible by default.
   */
  deletedAt: timestamp("deleted_at", { withTimezone: true }),

  /**
   * The admin user id who performed the soft-delete.
   * Self-referential FK — nullable because accounts can exist before this
   * feature was introduced and this is only set on soft-delete.
   */
  deletedBy: uuid("deleted_by").references((): AnyPgColumn => users.id, {
    onDelete: "set null",
  }),

  /** Last destination chosen on the choose-destination screen — 'trader' | 'admin' */
  lastChosenDestination: varchar("last_chosen_destination", { length: 10 }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User    = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
