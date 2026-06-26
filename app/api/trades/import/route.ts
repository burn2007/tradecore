import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { trades } from "@/db/schema/trades";
import { refreshStatsForUser } from "@/lib/refresh-stats";

/* ── Zod schema for each parsed trade coming from the client ── */
const parsedTradeSchema = z.object({
  symbol:          z.string().min(1).max(20).transform((v) => v.toUpperCase()),
  direction:       z.enum(["long", "short"]),
  entry_price:     z.string(),
  exit_price:      z.string().nullable(),
  size_lots:       z.string(),
  pnl_usd:         z.string().nullable(),
  commission:      z.string().nullable(),
  swap:            z.string().nullable(),
  stop_loss:       z.string().nullable(),
  take_profit:     z.string().nullable(),
  setup_tag:       z.string().nullable(),
  broker_trade_id: z.string().nullable(),
  entry_at:        z.string(),   // ISO string from JSON serialisation
  exit_at:         z.string().nullable(),
  session:         z.string(),
  source:          z.literal("csv"),
});

const importBodySchema = z.object({
  trades: z.array(parsedTradeSchema).min(1).max(10_000),
});

const BATCH_SIZE = 100;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = importBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const incomingTrades = parsed.data.trades;
  let totalImported = 0;
  let totalDuplicates = 0;
  let totalFailed = 0;

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < incomingTrades.length; i += BATCH_SIZE) {
    const batch = incomingTrades.slice(i, i + BATCH_SIZE);

    const rows = batch.map((t) => ({
      userId:        user.id,
      symbol:        t.symbol,
      direction:     t.direction,
      entryPrice:    t.entry_price,
      exitPrice:     t.exit_price ?? undefined,
      sizeLots:      t.size_lots,
      pnlUsd:        t.pnl_usd ?? undefined,
      commission:    t.commission ?? undefined,
      swap:          t.swap ?? undefined,
      stopLoss:      t.stop_loss ?? undefined,
      takeProfit:    t.take_profit ?? undefined,
      setupTag:      t.setup_tag ?? undefined,
      brokerTradeId: t.broker_trade_id ?? undefined,
      session:       t.session,
      source:        "csv" as const,
      isPaperTrade:  false,
      entryAt:       new Date(t.entry_at),
      exitAt:        t.exit_at ? new Date(t.exit_at) : undefined,
    }));

    try {
      // onConflictDoNothing targets the (user_id, broker_trade_id) unique constraint
      const inserted = await db
        .insert(trades)
        .values(rows)
        .onConflictDoNothing()
        .returning({ id: trades.id });

      totalImported  += inserted.length;
      totalDuplicates += batch.length - inserted.length;
    } catch (err) {
      console.error("Batch insert error:", err);
      totalFailed += batch.length;
    }
  }

  // Fire-and-forget: refresh stats directly in-process (no HTTP hop)
  void refreshStatsForUser(user.id).catch(() => {});

  return NextResponse.json({
    imported:           totalImported,
    duplicates_skipped: totalDuplicates,
    failed:             totalFailed,
  });
}
