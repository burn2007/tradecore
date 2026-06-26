/**
 * Core statistics engine for TradeCore.
 *
 * TWO APIs live in this file:
 *
 * 1. calculateStats(trades) — pure function, no DB, used by the old client-side
 *    stats path. Kept intact so existing callers don't break.
 *
 * 2. computeUserStats(userId, db) — async, runs against the DB, used by the
 *    /api/internal/refresh-stats background job to populate stats_cache.
 */

import {
  eq, and, isNotNull, sql, desc,
} from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { trades }        from "@/db/schema/trades";
import { ruleViolations } from "@/db/schema/rule_violations";
import { normaliseSession } from "@/lib/session-detector";

/* ═══════════════════════════════════════════════════════════════
   Legacy pure-function API (kept for existing callers)
═══════════════════════════════════════════════════════════════ */

export interface TradeResult {
  profit: number;
  pips?: number;
  riskRewardRatio?: number;
  isWin: boolean;
  durationMinutes?: number;
}

export interface TradingStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  /** Percentage: 0–100 */
  winRate: number;
  totalPnL: number;
  totalPips: number;
  averageWin: number;
  averageLoss: number;
  /** Gross profit / gross loss. Infinity if no losses. */
  profitFactor: number;
  /** (winRate × avgWin) − (lossRate × avgLoss) */
  expectancy: number;
  largestWin: number;
  largestLoss: number;
  averageRR: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  averageDurationMinutes: number;
}

export function calculateStats(tradeResults: TradeResult[]): TradingStats {
  if (tradeResults.length === 0) return emptyStats();

  const wins      = tradeResults.filter((t) => t.profit > 0);
  const losses    = tradeResults.filter((t) => t.profit < 0);
  const breakEvens = tradeResults.filter((t) => t.profit === 0);

  const grossProfit = wins.reduce((s, t) => s + t.profit, 0);
  const grossLoss   = Math.abs(losses.reduce((s, t) => s + t.profit, 0));
  const totalPnL    = grossProfit - grossLoss;
  const totalPips   = tradeResults.reduce((s, t) => s + (t.pips ?? 0), 0);

  const averageWin  = wins.length > 0   ? grossProfit / wins.length   : 0;
  const averageLoss = losses.length > 0 ? grossLoss   / losses.length : 0;

  const winRate      = wins.length / tradeResults.length;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const expectancy   = winRate * averageWin - (1 - winRate) * averageLoss;

  const rrValues = tradeResults
    .filter((t): t is TradeResult & { riskRewardRatio: number } => t.riskRewardRatio != null)
    .map((t) => t.riskRewardRatio);
  const averageRR = rrValues.length > 0
    ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length
    : 0;

  const durations = tradeResults
    .filter((t): t is TradeResult & { durationMinutes: number } => t.durationMinutes != null)
    .map((t) => t.durationMinutes);
  const averageDurationMinutes = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  const { maxWins, maxLosses } = calculateStreaks(tradeResults);

  return {
    totalTrades: tradeResults.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    breakEvenTrades: breakEvens.length,
    winRate: round(winRate * 100, 1),
    totalPnL: round(totalPnL, 2),
    totalPips: round(totalPips, 1),
    averageWin: round(averageWin, 2),
    averageLoss: round(averageLoss, 2),
    profitFactor: round(profitFactor, 2),
    expectancy: round(expectancy, 2),
    largestWin:  wins.length > 0   ? Math.max(...wins.map((t) => t.profit))   : 0,
    largestLoss: losses.length > 0 ? Math.abs(Math.min(...losses.map((t) => t.profit))) : 0,
    averageRR: round(averageRR, 2),
    maxConsecutiveWins: maxWins,
    maxConsecutiveLosses: maxLosses,
    averageDurationMinutes: round(averageDurationMinutes, 0),
  };
}

function calculateStreaks(tradeResults: TradeResult[]): { maxWins: number; maxLosses: number } {
  let maxWins = 0, maxLosses = 0;
  let curWins = 0, curLosses = 0;

  for (const t of tradeResults) {
    if (t.profit > 0) {
      curWins++; curLosses = 0;
      if (curWins > maxWins) maxWins = curWins;
    } else if (t.profit < 0) {
      curLosses++; curWins = 0;
      if (curLosses > maxLosses) maxLosses = curLosses;
    } else {
      curWins = 0; curLosses = 0;
    }
  }
  return { maxWins, maxLosses };
}

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

function emptyStats(): TradingStats {
  return {
    totalTrades: 0, winningTrades: 0, losingTrades: 0, breakEvenTrades: 0,
    winRate: 0, totalPnL: 0, totalPips: 0, averageWin: 0, averageLoss: 0,
    profitFactor: 0, expectancy: 0, largestWin: 0, largestLoss: 0,
    averageRR: 0, maxConsecutiveWins: 0, maxConsecutiveLosses: 0,
    averageDurationMinutes: 0,
  };
}

/* ═══════════════════════════════════════════════════════════════
   DB-backed computation — StatsResult
═══════════════════════════════════════════════════════════════ */

export interface StatsResult {
  totalTrades:       number;
  closedTrades:      number;
  openTrades:        number;

  winRate:           number | null;   // 0–100
  totalPnl:          number | null;
  phantomPnl:        number | null;
  behavioralGap:     number | null;

  avgRr:             number | null;
  ruleCompliancePct: number | null;

  bestSetup:         string | null;
  worstSession:      string | null;
  bestSession:       string | null;

  disciplineScore:   number;          // 0–100
  currentStreak:     number;
  longestStreak:     number;
}

type DrizzleClient = typeof defaultDb;

/**
 * Runs all stats queries for a user and returns a StatsResult.
 * Called by /api/internal/refresh-stats — never called from the client.
 */
export async function computeUserStats(
  userId: string,
  dbClient: DrizzleClient = defaultDb,
): Promise<StatsResult> {
  /* ── 1. Trade counts ─────────────────────────────────────────────────── */
  const [countsRow] = await dbClient
    .select({
      total:  sql<number>`count(*)::int`,
      closed: sql<number>`count(case when ${trades.pnlUsd} is not null then 1 end)::int`,
      open:   sql<number>`count(case when ${trades.pnlUsd} is null then 1 end)::int`,
    })
    .from(trades)
    .where(eq(trades.userId, userId));

  const totalTrades  = Number(countsRow?.total  ?? 0);
  const closedTrades = Number(countsRow?.closed  ?? 0);
  const openTrades   = Number(countsRow?.open    ?? 0);

  if (totalTrades === 0) {
    return zeroStats();
  }

  /* ── 2. Win rate + total P&L ─────────────────────────────────────────── */
  const [pnlRow] = await dbClient
    .select({
      totalPnl: sql<string>`sum(${trades.pnlUsd}::numeric)`,
      wins:     sql<number>`count(case when ${trades.pnlUsd}::numeric > 0 then 1 end)::int`,
    })
    .from(trades)
    .where(and(eq(trades.userId, userId), isNotNull(trades.pnlUsd)));

  const totalPnl     = pnlRow?.totalPnl != null ? parseFloat(pnlRow.totalPnl) : null;
  const winCount     = Number(pnlRow?.wins ?? 0);
  const winRate      = closedTrades > 0 ? round((winCount / closedTrades) * 100, 2) : null;

  /* ── 3. Phantom P&L (dashboard definition) ───────────────────────────── */
  // phantomPnl = totalPnl + absolute losses recovered from rule-violating trades.
  // "What you would have made if rule-breaking losses hadn't happened."
  // behavioralGap = the portion of P&L lost purely due to rule violations.
  // NOTE: must use EXISTS rather than an inner join on rule_violations — a trade
  // can have multiple violations (one per rule), and a join would multiply that
  // trade's loss into the sum once per violation row instead of once per trade.
  const [phantomRow] = await dbClient
    .select({
      lostToViolations: sql<string>`
        coalesce(sum(
          case when ${trades.pnlUsd}::numeric < 0
               then abs(${trades.pnlUsd}::numeric)
               else 0
          end
        ), 0)
      `,
    })
    .from(trades)
    .where(
      and(
        eq(trades.userId, userId),
        isNotNull(trades.pnlUsd),
        sql`exists (select 1 from rule_violations rv where rv.trade_id = ${trades.id})`,
      ),
    );

  const lostToViolations = phantomRow?.lostToViolations != null
    ? parseFloat(phantomRow.lostToViolations) : 0;
  const phantomPnl   = totalPnl != null ? round(totalPnl + lostToViolations, 2) : null;
  const behavioralGap = round(lostToViolations, 2);

  /* ── 4. Average R:R ──────────────────────────────────────────────────── */
  // risk  = |entry_price - stop_loss| × size_lots × 100000
  // reward = |pnl_usd|
  // rr     = reward / risk
  const [rrRow] = await dbClient
    .select({
      avgRr: sql<string>`
        avg(
          abs(${trades.pnlUsd}::numeric)
          /
          nullif(
            abs(${trades.entryPrice}::numeric - ${trades.stopLoss}::numeric)
            * ${trades.sizeLots}::numeric
            * 100000,
            0
          )
        )
      `,
      sampleCount: sql<number>`count(*)::int`,
    })
    .from(trades)
    .where(
      and(
        eq(trades.userId, userId),
        isNotNull(trades.pnlUsd),
        isNotNull(trades.stopLoss),
      )
    );

  // Requires at least 3 trades with stop_loss set, per spec.
  const avgRr = Number(rrRow?.sampleCount ?? 0) >= 3 && rrRow?.avgRr != null
    ? round(parseFloat(rrRow.avgRr), 3)
    : null;

  /* ── 5. Rule compliance % (closed trades only) ───────────────────────── */
  // Only violations on CLOSED trades (pnlUsd IS NOT NULL) count against compliance.
  // Open trades with violations are not penalized until they close.
  const [complianceRow] = await dbClient
    .select({
      violatingTrades: sql<number>`count(distinct ${ruleViolations.tradeId})::int`,
    })
    .from(ruleViolations)
    .innerJoin(
      trades,
      and(
        eq(trades.id, ruleViolations.tradeId),
        isNotNull(trades.pnlUsd),  // only closed trades affect compliance
      ),
    )
    .where(eq(ruleViolations.userId, userId));

  const violatingTrades  = Number(complianceRow?.violatingTrades ?? 0);
  const ruleCompliancePct = closedTrades > 0
    ? round(((closedTrades - violatingTrades) / closedTrades) * 100, 2)
    : null;

  /* ── 6. Best setup ───────────────────────────────────────────────────── */
  const setupRows = await dbClient
    .select({
      setupTag: trades.setupTag,
      total:    sql<number>`count(*)::int`,
      wins:     sql<number>`count(case when ${trades.pnlUsd}::numeric > 0 then 1 end)::int`,
    })
    .from(trades)
    .where(
      and(
        eq(trades.userId, userId),
        isNotNull(trades.pnlUsd),
        isNotNull(trades.setupTag),
      )
    )
    .groupBy(trades.setupTag);

  let bestSetup: string | null = null;
  let bestSetupWr = -1;
  for (const row of setupRows) {
    if (Number(row.total) >= 3) {
      const wr = Number(row.wins) / Number(row.total);
      if (wr > bestSetupWr) { bestSetupWr = wr; bestSetup = row.setupTag; }
    }
  }

  /* ── 7. Best / worst session ─────────────────────────────────────────── */
  // Raw session values must be normalised BEFORE grouping — legacy values like
  // "tokyo"/"sydney" collapse into "asian", "new_york" into "newyork", etc.
  const rawSessionRows = await dbClient
    .select({
      session: trades.session,
      total:   sql<number>`count(*)::int`,
      wins:    sql<number>`count(case when ${trades.pnlUsd}::numeric > 0 then 1 end)::int`,
    })
    .from(trades)
    .where(
      and(
        eq(trades.userId, userId),
        isNotNull(trades.pnlUsd),
        isNotNull(trades.session),
      )
    )
    .groupBy(trades.session);

  const sessionAgg = new Map<string, { total: number; wins: number }>();
  for (const row of rawSessionRows) {
    const key = normaliseSession(row.session);
    const entry = sessionAgg.get(key) ?? { total: 0, wins: 0 };
    entry.total += Number(row.total);
    entry.wins  += Number(row.wins);
    sessionAgg.set(key, entry);
  }

  let bestSession: string | null = null;
  let worstSession: string | null = null;
  let bestWr = -1, worstWr = 101;
  for (const [session, { total, wins }] of sessionAgg) {
    if (total >= 3) {
      const wr = wins / total;
      if (wr > bestWr)   { bestWr = wr;   bestSession  = session; }
      if (wr < worstWr)  { worstWr = wr;  worstSession = session; }
    }
  }

  /* ── 8. Discipline score ─────────────────────────────────────────────── */
  const compPct  = ruleCompliancePct ?? 50;
  const wrPct    = winRate           ?? 50;
  const rawScore = compPct * 0.6 + wrPct * 0.4;
  const disciplineScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  /* ── 9. Compliance streak (calendar days, working backwards) ─────────── */
  // Fetch all closed trades ordered by date descending to walk the calendar.
  const recentTrades = await dbClient
    .select({
      dateKey:      sql<string>`to_char(${trades.entryAt} at time zone 'UTC', 'YYYY-MM-DD')`,
      tradeId:      trades.id,
      hasViolation: sql<boolean>`
        exists (
          select 1 from rule_violations rv
          where rv.trade_id = ${trades.id}
        )
      `,
    })
    .from(trades)
    .where(and(eq(trades.userId, userId), isNotNull(trades.pnlUsd)))
    .orderBy(desc(trades.entryAt));

  // Group by calendar day
  const dayMap = new Map<string, { total: number; violations: number }>();
  for (const row of recentTrades) {
    const key = row.dateKey;
    if (!dayMap.has(key)) dayMap.set(key, { total: 0, violations: 0 });
    const entry = dayMap.get(key)!;
    entry.total++;
    if (row.hasViolation) entry.violations++;
  }

  // Walk backwards from today counting consecutive compliant days
  let currentStreak = 0;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const day = dayMap.get(key);

    if (!day || day.total === 0) break; // gap in journaling
    if (day.violations > 0)     break; // day with violations

    currentStreak++;
  }

  // Longest streak ever (walk forward through sorted days)
  const sortedDays = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b));

  let longestStreak = 0, runStreak = 0, prevKey = "";
  for (const [key, day] of sortedDays) {
    // Check if this day is consecutive with prev (1 day apart)
    let consecutive = false;
    if (prevKey) {
      const prev = new Date(prevKey);
      prev.setUTCDate(prev.getUTCDate() + 1);
      consecutive = prev.toISOString().slice(0, 10) === key;
    }

    if (consecutive && day.violations === 0) {
      runStreak++;
    } else if (day.violations === 0) {
      runStreak = 1;
    } else {
      runStreak = 0;
    }

    if (runStreak > longestStreak) longestStreak = runStreak;
    prevKey = key;
  }

  return {
    totalTrades,
    closedTrades,
    openTrades,
    winRate,
    totalPnl,
    phantomPnl,
    behavioralGap,
    avgRr,
    ruleCompliancePct,
    bestSetup,
    worstSession,
    bestSession,
    disciplineScore,
    currentStreak,
    longestStreak,
  };
}

function zeroStats(): StatsResult {
  // disciplineScore formula defaults compliance_pct/win_rate to 50 when null,
  // so a trader with zero trades scores 50 (neutral), not 0.
  return {
    totalTrades: 0, closedTrades: 0, openTrades: 0,
    winRate: null, totalPnl: null, phantomPnl: null, behavioralGap: null,
    avgRr: null, ruleCompliancePct: null,
    bestSetup: null, worstSession: null, bestSession: null,
    disciplineScore: 50, currentStreak: 0, longestStreak: 0,
  };
}
