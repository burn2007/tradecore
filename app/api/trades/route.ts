import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { trades } from "@/db/schema/trades";
import { emotionLogs } from "@/db/schema/emotion_logs";
import { ruleViolations } from "@/db/schema/rule_violations";
import { tradeScreenshots } from "@/db/schema/trade_screenshots";
import { detectSession } from "@/lib/session-detector";
import { eq, and, gte, lte, ilike, desc, count, sql } from "drizzle-orm";
import { refreshStatsForUser } from "@/lib/refresh-stats";


const tradeSchema = z.object({
  symbol:        z.string().min(3).max(20).transform((v) => v.toUpperCase()),
  direction:     z.enum(["long", "short"]),
  entryPrice:    z.number().positive().optional(),
  exitPrice:     z.number().positive().optional(),
  sizeLots:      z.number().positive().optional(),
  pnlUsd:        z.number().optional(),
  stopLoss:      z.number().positive().optional(),
  takeProfit:    z.number().positive().optional(),
  setupTag:      z.string().max(80).optional(),
  entryAt:       z.string().datetime(),
  exitAt:        z.string().datetime().optional(),
  isPaperTrade:  z.boolean().optional().default(false),
  preMood:       z.number().int().min(1).max(5).optional(),
  preNote:       z.string().max(1000).optional(),
  screenshotKey: z.string().optional(),
  screenshotUrl: z.string().url().optional(),
});

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const symbol    = searchParams.get("symbol")?.toUpperCase() ?? "";
  const direction = searchParams.get("direction") ?? "";
  const session   = searchParams.get("session") ?? "";
  const setupTag  = searchParams.get("setupTag") ?? "";
  const from      = searchParams.get("from") ?? "";
  const to        = searchParams.get("to") ?? "";
  const limit     = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const offset    = parseInt(searchParams.get("offset") ?? "0", 10);

  // Build WHERE conditions
  const conditions = [eq(trades.userId, user.id)];
  if (symbol)    conditions.push(ilike(trades.symbol, `%${symbol}%`));
  if (direction) conditions.push(eq(trades.direction, direction));
  if (session)   conditions.push(eq(trades.session, session));
  if (setupTag)  conditions.push(ilike(trades.setupTag, `%${setupTag}%`));
  if (from)      conditions.push(gte(trades.entryAt, new Date(from)));
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(trades.entryAt, toDate));
  }

  const where = and(...conditions);

  // Fetch rows + total count in parallel
  console.time(`[trades] GET list user=${user.id.slice(0, 8)}`);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id:          trades.id,
        symbol:      trades.symbol,
        direction:   trades.direction,
        entryPrice:  trades.entryPrice,
        exitPrice:   trades.exitPrice,
        sizeLots:    trades.sizeLots,
        pnlUsd:      trades.pnlUsd,
        setupTag:    trades.setupTag,
        session:     trades.session,
        source:      trades.source,
        isPaperTrade:trades.isPaperTrade,
        entryAt:     trades.entryAt,
        exitAt:      trades.exitAt,
        createdAt:   trades.createdAt,
        // Aggregates for compliance indicator
        violationCount: sql<number>`cast(count(distinct ${ruleViolations.id}) as int)`,
        hasEmotionLog:  sql<boolean>`bool_or(${emotionLogs.id} is not null)`,
      })
      .from(trades)
      .leftJoin(ruleViolations, eq(ruleViolations.tradeId, trades.id))
      .leftJoin(emotionLogs, eq(emotionLogs.tradeId, trades.id))
      .where(where)
      .groupBy(trades.id)
      .orderBy(desc(trades.entryAt))
      .limit(limit)
      .offset(offset),

    db
      .select({ total: count() })
      .from(trades)
      .where(where),
  ]);

  console.timeEnd(`[trades] GET list user=${user.id.slice(0, 8)}`);
  return NextResponse.json({ data: rows, total: Number(total), limit, offset });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = tradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const d = parsed.data;
  const entryDate = new Date(d.entryAt);
  const session = detectSession(entryDate);

  console.time(`[trades] POST insert user=${user.id.slice(0, 8)}`);
  const [trade] = await db.insert(trades).values({
    userId:       user.id,
    symbol:       d.symbol,
    direction:    d.direction,
    entryPrice:   d.entryPrice != null ? String(d.entryPrice) : undefined,
    exitPrice:    d.exitPrice != null ? String(d.exitPrice) : undefined,
    sizeLots:     d.sizeLots != null ? String(d.sizeLots) : undefined,
    pnlUsd:       d.pnlUsd != null ? String(d.pnlUsd) : undefined,
    stopLoss:     d.stopLoss != null ? String(d.stopLoss) : undefined,
    takeProfit:   d.takeProfit != null ? String(d.takeProfit) : undefined,
    setupTag:     d.setupTag,
    session,
    source:       "manual",
    isPaperTrade: d.isPaperTrade ?? false,
    entryAt:      entryDate,
    exitAt:       d.exitAt ? new Date(d.exitAt) : undefined,
  }).returning();

  const insertions: Promise<unknown>[] = [];

  if (d.preMood || d.preNote) {
    insertions.push(
      db.insert(emotionLogs).values({
        tradeId: trade.id,
        userId:  user.id,
        preMood: d.preMood,
        preNote: d.preNote,
      })
    );
  }

  if (d.screenshotUrl && d.screenshotKey) {
    insertions.push(
      db.insert(tradeScreenshots).values({
        tradeId: trade.id,
        userId:  user.id,
        r2Key:   d.screenshotKey,
        r2Url:   d.screenshotUrl,
      })
    );
  }

  await Promise.all(insertions);
  console.timeEnd(`[trades] POST insert user=${user.id.slice(0, 8)}`);

  // Fire-and-forget: refresh stats directly in-process (no HTTP hop)
  void refreshStatsForUser(user.id).catch(() => {});

  return NextResponse.json({
    id:        trade.id,
    symbol:    trade.symbol,
    direction: trade.direction,
    pnlUsd:    trade.pnlUsd,
  }, { status: 201 });
}
