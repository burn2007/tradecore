/**
 * refreshStatsForUser — callable directly from any server-side code.
 *
 * Replaces the fire-and-forget HTTP self-call approach with a direct function
 * call. This eliminates the unreliable network hop to localhost and guarantees
 * stats_cache is updated in-process after every trade mutation.
 *
 * Used by:
 *  - app/api/trades/route.ts          (POST)
 *  - app/api/trades/[id]/review/route.ts (PATCH)
 *  - app/api/trades/import/route.ts   (POST)
 *  - app/api/internal/refresh-stats/route.ts (HTTP entry point, kept for external callers)
 */

import { eq, and, sql } from "drizzle-orm";
import { db as defaultDb, withUserContext } from "@/lib/db";
import { statsCache }     from "@/db/schema/stats_cache";
import { userMilestones } from "@/db/schema/user_milestones";
import { trades }         from "@/db/schema/trades";
import { ruleViolations } from "@/db/schema/rule_violations";
import { computeUserStats, type StatsResult } from "@/lib/stats";

type DrizzleClient = typeof defaultDb;

export interface MilestoneDef {
  key:   string;
  label: string;
  icon:  string;
}

export const MILESTONES: MilestoneDef[] = [
  { key: "first_trade",          label: "First trade logged!",      icon: "🎯" },
  { key: "10_trades",            label: "10 trades logged",         icon: "📈" },
  { key: "50_trades",            label: "50 trades logged",         icon: "🔥" },
  { key: "100_trades",           label: "100 trades logged",        icon: "💎" },
  { key: "first_profit",         label: "First profitable session", icon: "✅" },
  { key: "first_compliant_week", label: "Perfect compliance week!", icon: "🏆" },
  { key: "7_day_streak",         label: "7-day compliance streak!", icon: "⚡" },
];

export interface RefreshResult {
  stats: StatsResult;
  newly_achieved: MilestoneDef[];
}

/**
 * Computes stats for `userId`, upserts stats_cache, checks milestone
 * conditions, and returns any newly achieved milestones.
 *
 * Safe to call fire-and-forget: `void refreshStatsForUser(id).catch(() => {})`
 */
export async function refreshStatsForUser(
  userId:   string,
  dbClient: DrizzleClient = defaultDb,
): Promise<RefreshResult> {
  // When called without an explicit client (fire-and-forget from API routes),
  // wrap in user context so RLS policies are satisfied on the restricted role.
  if (dbClient === defaultDb) {
    return withUserContext(userId, (tx) =>
      refreshStatsForUser(userId, tx as unknown as DrizzleClient)
    );
  }

  console.time(`[refresh-stats] total user=${userId.slice(0, 8)}`);

  /* ── 1. Compute fresh stats ── */
  const stats = await computeUserStats(userId, dbClient);

  /* ── 2. Upsert into stats_cache ── */
  const cacheRow = {
    userId,
    winRate:           stats.winRate           != null ? String(stats.winRate)           : null,
    totalPnl:          stats.totalPnl           != null ? String(stats.totalPnl)          : null,
    phantomPnl:        stats.phantomPnl         != null ? String(stats.phantomPnl)        : null,
    behavioralGap:     stats.behavioralGap      != null ? String(stats.behavioralGap)     : null,
    avgRr:             stats.avgRr              != null ? String(stats.avgRr)             : null,
    totalTrades:       stats.totalTrades,
    closedTrades:      stats.closedTrades,
    openTrades:        stats.openTrades,
    ruleCompliancePct: stats.ruleCompliancePct  != null ? String(stats.ruleCompliancePct) : null,
    bestSetup:         stats.bestSetup,
    worstSession:      stats.worstSession,
    bestSession:       stats.bestSession,
    currentStreak:     stats.currentStreak,
    longestStreak:     stats.longestStreak,
    disciplineScore:   String(stats.disciplineScore),
    computedAt:        new Date(),
  };

  await dbClient
    .insert(statsCache)
    .values(cacheRow)
    .onConflictDoUpdate({
      target: statsCache.userId,
      set:    cacheRow,
    });

  /* ── 3. Milestone evaluation ── */
  const existing = await dbClient
    .select({ milestoneKey: userMilestones.milestoneKey })
    .from(userMilestones)
    .where(eq(userMilestones.userId, userId));

  const alreadyAchieved = new Set(existing.map((r) => r.milestoneKey));
  const conditionsMet   = new Set<string>();

  if (stats.totalTrades >= 1)   conditionsMet.add("first_trade");
  if (stats.totalTrades >= 10)  conditionsMet.add("10_trades");
  if (stats.totalTrades >= 50)  conditionsMet.add("50_trades");
  if (stats.totalTrades >= 100) conditionsMet.add("100_trades");
  if (stats.totalPnl != null && stats.totalPnl > 0) conditionsMet.add("first_profit");
  if (stats.currentStreak >= 7) conditionsMet.add("7_day_streak");

  // 'first_compliant_week': any ISO week with ≥3 trades and 0 violations
  const weekViolations = await dbClient
    .select({
      weekKey:    sql<string>`to_char(${trades.entryAt} at time zone 'UTC', 'IYYY-IW')`,
      tradeCount: sql<number>`count(distinct ${trades.id})::int`,
      violCount:  sql<number>`count(distinct ${ruleViolations.id})::int`,
    })
    .from(trades)
    .leftJoin(ruleViolations, and(
      eq(ruleViolations.tradeId, trades.id),
      eq(ruleViolations.userId,  userId),
    ))
    .where(eq(trades.userId, userId))
    .groupBy(sql`to_char(${trades.entryAt} at time zone 'UTC', 'IYYY-IW')`);

  for (const row of weekViolations) {
    if (Number(row.tradeCount) >= 3 && Number(row.violCount) === 0) {
      conditionsMet.add("first_compliant_week");
      break;
    }
  }

  const newlyAchievedKeys = [...conditionsMet].filter((k) => !alreadyAchieved.has(k));

  if (newlyAchievedKeys.length > 0) {
    await dbClient
      .insert(userMilestones)
      .values(newlyAchievedKeys.map((key) => ({
        userId,
        milestoneKey: key,
        achievedAt:   new Date(),
      })))
      .onConflictDoNothing();
  }

  const newly_achieved = newlyAchievedKeys
    .map((key) => MILESTONES.find((m) => m.key === key))
    .filter(Boolean) as MilestoneDef[];

  console.timeEnd(`[refresh-stats] total user=${userId.slice(0, 8)}`);
  return { stats, newly_achieved };
}
