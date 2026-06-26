import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { trades } from "@/db/schema/trades";
import { emotionLogs } from "@/db/schema/emotion_logs";
import { ruleViolations } from "@/db/schema/rule_violations";
import { rules } from "@/db/schema/rules";
import { tradeScreenshots } from "@/db/schema/trade_screenshots";
import { refreshStatsForUser } from "@/lib/refresh-stats";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ── GET /api/trades/[id] ─────────────────────────────────────────────────────
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [trade] = await db
    .select()
    .from(trades)
    .where(and(eq(trades.id, id), eq(trades.userId, user.id)))
    .limit(1);

  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Parallel fetch: emotion log, violations with rule titles, screenshots
  const [emotionLog, violations, screenshots] = await Promise.all([
    db.select().from(emotionLogs).where(eq(emotionLogs.tradeId, id)).limit(1),
    db
      .select({
        id:        ruleViolations.id,
        ruleId:    ruleViolations.ruleId,
        ruleTitle: rules.title,
      })
      .from(ruleViolations)
      .leftJoin(rules, eq(rules.id, ruleViolations.ruleId))
      .where(eq(ruleViolations.tradeId, id)),
    db.select().from(tradeScreenshots).where(eq(tradeScreenshots.tradeId, id)),
  ]);

  return NextResponse.json({
    trade,
    emotionLog: emotionLog[0] ?? null,
    violations,
    screenshots,
  });
}

// ── PATCH /api/trades/[id] ───────────────────────────────────────────────────
const patchSchema = z.object({
  symbol:      z.string().min(3).max(20).transform((v) => v.toUpperCase()).optional(),
  direction:   z.enum(["long", "short"]).optional(),
  entryPrice:  z.number().positive().optional(),
  exitPrice:   z.number().positive().nullable().optional(),
  sizeLots:    z.number().positive().optional(),
  pnlUsd:      z.number().nullable().optional(),
  stopLoss:    z.number().positive().nullable().optional(),
  takeProfit:  z.number().positive().nullable().optional(),
  setupTag:    z.string().max(80).nullable().optional(),
  entryAt:     z.string().datetime().optional(),
  exitAt:      z.string().datetime().nullable().optional(),
  isPaperTrade:z.boolean().optional(),
}).partial();

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Confirm ownership
  const [existing] = await db
    .select({ id: trades.id })
    .from(trades)
    .where(and(eq(trades.id, id), eq(trades.userId, user.id)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const d = parsed.data;
  const updates: Record<string, unknown> = {};
  if (d.symbol      !== undefined) updates.symbol      = d.symbol;
  if (d.direction   !== undefined) updates.direction   = d.direction;
  if (d.entryPrice  !== undefined) updates.entryPrice  = String(d.entryPrice);
  if (d.exitPrice   !== undefined) updates.exitPrice   = d.exitPrice != null ? String(d.exitPrice) : null;
  if (d.sizeLots    !== undefined) updates.sizeLots    = String(d.sizeLots);
  if (d.pnlUsd      !== undefined) updates.pnlUsd      = d.pnlUsd != null ? String(d.pnlUsd) : null;
  if (d.stopLoss    !== undefined) updates.stopLoss    = d.stopLoss != null ? String(d.stopLoss) : null;
  if (d.takeProfit  !== undefined) updates.takeProfit  = d.takeProfit != null ? String(d.takeProfit) : null;
  if (d.setupTag    !== undefined) updates.setupTag    = d.setupTag;
  if (d.entryAt     !== undefined) updates.entryAt     = new Date(d.entryAt);
  if (d.exitAt      !== undefined) updates.exitAt      = d.exitAt ? new Date(d.exitAt) : null;
  if (d.isPaperTrade!== undefined) updates.isPaperTrade = d.isPaperTrade;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(trades)
    .set(updates)
    .where(and(eq(trades.id, id), eq(trades.userId, user.id)))
    .returning();

  // Fire-and-forget: refresh stats directly in-process (no HTTP hop)
  void refreshStatsForUser(user.id).catch(() => {});

  return NextResponse.json({ trade: updated });
}

// ── DELETE /api/trades/[id] ──────────────────────────────────────────────────
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [deleted] = await db
    .delete(trades)
    .where(and(eq(trades.id, id), eq(trades.userId, user.id)))
    .returning({ id: trades.id });

  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fire-and-forget: refresh stats directly in-process (no HTTP hop)
  void refreshStatsForUser(user.id).catch(() => {});

  return NextResponse.json({ ok: true });
}
