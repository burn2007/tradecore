import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withUserContext } from "@/lib/db";
import { trades } from "@/db/schema/trades";
import { ruleViolations } from "@/db/schema/rule_violations";
import { eq, and, gte, sql } from "drizzle-orm";
import { normaliseSession } from "@/lib/session-detector";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = user.id;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  console.time(`[analytics] all-queries user=${userId.slice(0, 8)}`);

  // ── All 6 queries run in parallel inside user context ─────────────────────
  const [
    heatmapRows,
    dayViolationsRows,
    setupRows,
    overallRows,
    sessionRows,
    signalRows,
  ] = await withUserContext(userId, (tx) =>
    Promise.all([

      // 1. Heatmap data — violations + trade counts per calendar day
      tx
        .select({
          date: sql<string>`to_char(${trades.entryAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
          trade_count: sql<number>`cast(count(distinct ${trades.id}) as int)`,
          violation_count: sql<number>`cast(count(distinct ${ruleViolations.id}) as int)`,
        })
        .from(trades)
        .leftJoin(ruleViolations, eq(ruleViolations.tradeId, trades.id))
        .where(and(eq(trades.userId, userId), gte(trades.entryAt, thirtyDaysAgo)))
        .groupBy(sql`to_char(${trades.entryAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${trades.entryAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`),

      // 2. Worst day of week — average violations per weekday
      tx
        .select({
          dow: sql<number>`cast(extract(dow from ${trades.entryAt} AT TIME ZONE 'UTC') as int)`,
          avg_violations: sql<number>`avg(sub.vc)`,
        })
        .from(
          tx
            .select({
              tradeDay: sql<string>`to_char(${trades.entryAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`.as("trade_day"),
              dow: sql<number>`cast(extract(dow from ${trades.entryAt} AT TIME ZONE 'UTC') as int)`.as("dow"),
              vc: sql<number>`cast(count(distinct ${ruleViolations.id}) as int)`.as("vc"),
            })
            .from(trades)
            .leftJoin(ruleViolations, eq(ruleViolations.tradeId, trades.id))
            .where(and(eq(trades.userId, userId), gte(trades.entryAt, thirtyDaysAgo)))
            .groupBy(
              sql`to_char(${trades.entryAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
              sql`cast(extract(dow from ${trades.entryAt} AT TIME ZONE 'UTC') as int)`
            )
            .as("sub")
        )
        .groupBy(sql`cast(extract(dow from ${trades.entryAt} AT TIME ZONE 'UTC') as int)`)
        .orderBy(sql`avg(sub.vc) desc`),

      // 3. Setup performance — win rate + trade count per setup tag
      tx
        .select({
          setup_tag: trades.setupTag,
          trade_count: sql<number>`cast(count(*) as int)`,
          win_count: sql<number>`cast(sum(case when cast(${trades.pnlUsd} as numeric) > 0 then 1 else 0 end) as int)`,
          avg_pnl: sql<number>`round(avg(cast(${trades.pnlUsd} as numeric))::numeric, 2)`,
        })
        .from(trades)
        .where(
          and(
            eq(trades.userId, userId),
            sql`${trades.setupTag} is not null`,
            sql`${trades.pnlUsd} is not null`
          )
        )
        .groupBy(trades.setupTag)
        .orderBy(sql`round((sum(case when cast(${trades.pnlUsd} as numeric) > 0 then 1 else 0 end)::numeric / nullif(count(*), 0)) * 100, 1) desc`),

      // 4. Overall win rate (for reference line)
      tx
        .select({
          total: sql<number>`cast(count(*) as int)`,
          wins: sql<number>`cast(sum(case when cast(${trades.pnlUsd} as numeric) > 0 then 1 else 0 end) as int)`,
        })
        .from(trades)
        .where(and(eq(trades.userId, userId), sql`${trades.pnlUsd} is not null`)),

      // 5. Session breakdown (raw session grouped, normalised in JS)
      tx
        .select({
          session: trades.session,
          trade_count: sql<number>`cast(count(*) as int)`,
          win_count: sql<number>`cast(sum(case when cast(${trades.pnlUsd} as numeric) > 0 then 1 else 0 end) as int)`,
          sum_pnl: sql<number>`coalesce(sum(cast(${trades.pnlUsd} as numeric)), 0)`,
        })
        .from(trades)
        .where(
          and(
            eq(trades.userId, userId),
            sql`${trades.session} is not null`,
            sql`${trades.pnlUsd} is not null`
          )
        )
        .groupBy(trades.session),

      // 6. Signal accuracy
      tx
        .select({
          signal_source: trades.signalSource,
          trade_count: sql<number>`cast(count(*) as int)`,
          win_count: sql<number>`cast(sum(case when cast(${trades.pnlUsd} as numeric) > 0 then 1 else 0 end) as int)`,
        })
        .from(trades)
        .where(
          and(
            eq(trades.userId, userId),
            sql`${trades.signalSource} is not null`,
            sql`${trades.pnlUsd} is not null`
          )
        )
        .groupBy(trades.signalSource),
    ])
  );

  console.timeEnd(`[analytics] all-queries user=${userId.slice(0, 8)}`);

  // ── JS aggregations ───────────────────────────────────────────────────────

  // Extract worst trading day (only Mon–Fri, dow 1–5)
  const weekdayRows = dayViolationsRows.filter((r) => r.dow >= 1 && r.dow <= 5);
  const worstDayOfWeek = weekdayRows.length > 0
    ? DAY_NAMES[weekdayRows[0].dow]
    : null;

  const setupPerformance = setupRows
    .filter((r) => r.setup_tag && r.trade_count >= 1)
    .map((r) => ({
      setup_tag: r.setup_tag!,
      trade_count: r.trade_count,
      win_rate: r.trade_count > 0
        ? Math.round((r.win_count / r.trade_count) * 1000) / 10
        : 0,
      avg_pnl: Number(r.avg_pnl ?? 0),
    }))
    .sort((a, b) => b.win_rate - a.win_rate);

  const overallRow = overallRows[0];
  const overallWinRate = overallRow && overallRow.total > 0
    ? Math.round((overallRow.wins / overallRow.total) * 1000) / 10
    : 50;

  const allSessions = ["london", "newyork", "asian", "african"];

  const sessionAgg: Record<string, { trade_count: number; win_count: number; sum_pnl: number }> = {};
  for (const row of sessionRows) {
    const key = normaliseSession(row.session);
    if (!sessionAgg[key]) sessionAgg[key] = { trade_count: 0, win_count: 0, sum_pnl: 0 };
    sessionAgg[key].trade_count += Number(row.trade_count);
    sessionAgg[key].win_count   += Number(row.win_count);
    sessionAgg[key].sum_pnl     += Number(row.sum_pnl);
  }

  const sessionBreakdown = allSessions.map((s) => {
    const row = sessionAgg[s];
    if (!row || row.trade_count === 0) return { session: s, trade_count: 0, win_rate: 0, avg_pnl: 0 };
    return {
      session: s,
      trade_count: row.trade_count,
      win_rate: Math.round((row.win_count / row.trade_count) * 1000) / 10,
      avg_pnl: Math.round((row.sum_pnl / row.trade_count) * 100) / 100,
    };
  });

  const tradedSessions = sessionBreakdown
    .filter((s) => s.trade_count > 0)
    .sort((a, b) => b.win_rate - a.win_rate);

  const bestSession  = tradedSessions[0]?.session ?? null;
  const worstSession = tradedSessions[tradedSessions.length - 1]?.session ?? null;

  const signalAccuracy = signalRows
    .filter((r) => r.signal_source)
    .map((r) => ({
      signal_source: r.signal_source!,
      trade_count: r.trade_count,
      win_rate: r.trade_count > 0
        ? Math.round((r.win_count / r.trade_count) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.win_rate - a.win_rate);

  return NextResponse.json({
    heatmap_data: heatmapRows,
    setup_performance: setupPerformance,
    session_breakdown: sessionBreakdown,
    signal_accuracy: signalAccuracy,
    overall_win_rate: overallWinRate,
    worst_day_of_week: worstDayOfWeek,
    best_session: bestSession,
    worst_session: worstSession,
  });
}
