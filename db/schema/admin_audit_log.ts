import { pgTable, uuid, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Audit trail for every admin action and every unauthorized attempt to
 * access an admin route. Written by lib/audit-log.ts.
 */
export const adminAuditLog = pgTable("admin_audit_log", {
  id:          uuid("id").primaryKey().defaultRandom(),
  adminUserId: uuid("admin_user_id")
                 .notNull()
                 .references(() => users.id, { onDelete: "cascade" }),

  action:     varchar("action", { length: 100 }).notNull(),
  targetType: varchar("target_type", { length: 50 }),
  targetId:   uuid("target_id"),
  details:    jsonb("details"),
  ipAddress:  varchar("ip_address", { length: 45 }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminAuditLog    = typeof adminAuditLog.$inferSelect;
export type NewAdminAuditLog = typeof adminAuditLog.$inferInsert;
