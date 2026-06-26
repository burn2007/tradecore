import { type NextRequest, NextResponse } from "next/server";
import { eq, and, desc, gte, gt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { trades } from "@/db/schema/trades";
import { ruleViolations } from "@/db/schema/rule_violations";
import { statsCache } from "@/db/schema/stats_cache";
import { userMilestones } from "@/db/schema/user_milestones";
import { normaliseSession } from "@/lib/session-detector";

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Shared date boundaries ────────────────────────────────────────────────
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const sixtySecondsAgo = new Date(Date.now() - 60_000);

  // ── All 6 queries run in parallel (stats cache is independent of the others) ──
  console.time(`[dashboard] all-queries user=${user.id.slice(0, 8)}`);
  const [
    statsResult,
    equityTrades,
    monthlyRow,
    sessionRows,
    recentTrades,
    newMilestones,
  ] = await Promise.all([
    // 0. Stats cache
    db
      .select()
      .from(statsCache)
      .where(eq(statsCache.userId, user.id))
      .limit(1),

    // 3a. Equity curve — LEFT JOIN replaces correlated EXISTS (no N+1)
    db
      .select({
        entryAt:      trades.entryAt,
        pnlUsd:       trades.pnlUsd,
        hasViolation: sql<boolean>`count(${ruleViolations.id}) > 0`,
      })
      .from(trades)
      .leftJoin(ruleViolations, eq(ruleViolations.tradeId, trades.id))
      .where(
        and(
          eq(trades.userId, user.id),
          gte(trades.entryAt, ninetyDaysAgo),
          sql`${trades.pnlUsd} is not null`,
        )
      )
      .groupBy(trades.id, trades.entryAt, trades.pnlUsd)
      .orderBy(trades.entryAt),

    // 3b. Month-to-date P&L
    db
      .select({
        monthlyPnl: sql<string>`coalesce(sum(${trades.pnlUsd}::numeric), 0)`,
      })
      .from(trades)
      .where(
        and(
          eq(trades.userId, user.id),
          sql`${trades.pnlUsd} is not null`,
          gte(trades.entryAt, monthStart),
        )
      ),

    // 3c. Session edge (will be normalised in JS below)
    db
      .select({
        session: trades.session,
        total:   sql<number>`count(*)::int`,
        wins:    sql<number>`count(case when ${trades.pnlUsd}::numeric > 0 then 1 end)::int`,
      })
      .from(trades)
      .where(
        and(
          eq(trades.userId, user.id),
          sql`${trades.pnlUsd} is not null`,
          sql`${trades.session} is not null`,
        )
      )
      .groupBy(trades.session),

    // 3d. Recent 5 trades
    db
      .select({
        id:             trades.id,
        symbol:         trades.symbol,
        direction:      trades.direction,
        pnlUsd:         trades.pnlUsd,
        setupTag:       trades.setupTag,
        session:        trades.session,
        source:         trades.source,
        entryAt:        trades.entryAt,
        exitAt:         trades.exitAt,
        violationCount: sql<number>`cast(count(distinct ${ruleViolations.id}) as int)`,
      })
      .from(trades)
      .leftJoin(ruleViolations, eq(ruleViolations.tradeId, trades.id))
      .where(eq(trades.userId, user.id))
      .groupBy(trades.id)
      .orderBy(desc(trades.entryAt))
      .limit(5),

    // 3e. Milestones achieved in the last 60 seconds (for toast notifications)
    db
      .select({ milestoneKey: userMilestones.milestoneKey, achievedAt: userMilestones.achievedAt })
      .from(userMilestones)
      .where(
        and(
          eq(userMilestones.userId, user.id),
          gt(userMilestones.achievedAt, sixtySecondsAgo),
        )
      )
      .orderBy(desc(userMilestones.achievedAt)),
  ]);

  console.timeEnd(`[dashboard] all-queries user=${user.id.slice(0, 8)}`);

  // ── Extract stats cache ───────────────────────────────────────────────────
  const [cachedStats] = statsResult;
  const effectiveStats = cachedStats
    ? {
        winRate:           cachedStats.winRate,
        totalPnl:          cachedStats.totalPnl,
        phantomPnl:        cachedStats.phantomPnl,
        behavioralGap:     cachedStats.behavioralGap,
        totalTrades:       cachedStats.totalTrades,
        closedTrades:      cachedStats.closedTrades,
        ruleCompliancePct: cachedStats.ruleCompliancePct,
        bestSession:       cachedStats.bestSession,
        currentStreak:     cachedStats.currentStreak,
        disciplineScore:   cachedStats.disciplineScore,
      }
    : null;

  // ── Build equity curve ────────────────────────────────────────────────────
  let runReal = 0, runPhantom = 0;
  const equityCurve = equityTrades.map((t) => {
    const pnl = parseFloat(t.pnlUsd ?? "0");
    runReal += pnl;
    runPhantom += t.hasViolation && pnl < 0 ? 0 : pnl;
    return {
      date:    t.entryAt,
      real:    Math.round(runReal    * 100) / 100,
      phantom: Math.round(runPhantom * 100) / 100,
    };
  });

  // ── Scalar derivations ────────────────────────────────────────────────────
  const totalPnl      = parseFloat(effectiveStats?.totalPnl      ?? "0");
  const phantomPnl    = parseFloat(effectiveStats?.phantomPnl    ?? String(totalPnl));
  const behavioralGap = parseFloat(effectiveStats?.behavioralGap ?? "0");
  const monthlyPnl    = parseFloat(monthlyRow?.[0]?.monthlyPnl   ?? "0");

  // ── Session edge — merge legacy keys (tokyo→asian, etc.) ─────────────────
  const sessionAgg: Record<string, { total: number; wins: number }> = {};
  for (const row of sessionRows) {
    const key = normaliseSession(row.session);
    if (!sessionAgg[key]) sessionAgg[key] = { total: 0, wins: 0 };
    sessionAgg[key].total += Number(row.total);
    sessionAgg[key].wins  += Number(row.wins);
  }
  const sessionEdge = Object.entries(sessionAgg).map(([session, { total, wins }]) => ({
    session,
    total,
    wins,
    winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
  }));

  return NextResponse.json({
    stats:          effectiveStats,
    equityCurve,
    phantomPnl,
    behavioralGap,
    monthlyPnl,
    sessionEdge,
    recentTrades,
    totalTrades:    effectiveStats?.totalTrades ?? 0,
    newly_achieved: newMilestones,
  });
}
