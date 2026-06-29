import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { withUserContext } from "@/lib/db";
import { trades } from "@/db/schema/trades";
import { emotionLogs } from "@/db/schema/emotion_logs";
import { ruleViolations } from "@/db/schema/rule_violations";
import { refreshStatsForUser } from "@/lib/refresh-stats";

const reviewSchema = z.object({
  postMood:       z.number().int().min(1).max(5).optional(),
  postNote:       z.string().max(2000).optional(),
  violatedRuleIds: z.array(z.string().uuid()).optional().default([]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { postMood, postNote, violatedRuleIds } = parsed.data;

  console.time(`[trades/${id.slice(0, 8)}] review PATCH`);
  const ok = await withUserContext(user.id, async (tx) => {
    const [trade] = await tx
      .select({ id: trades.id })
      .from(trades)
      .where(and(eq(trades.id, id), eq(trades.userId, user.id)))
      .limit(1);

    if (!trade) return false;

    const ops: Promise<unknown>[] = [];

    if (postMood || postNote) {
      ops.push(
        tx.insert(emotionLogs)
          .values({ tradeId: id, userId: user.id, postMood, postNote })
          .onConflictDoUpdate({
            target: emotionLogs.tradeId,
            set: {
              postMood: postMood ?? undefined,
              postNote: postNote ?? undefined,
            },
          })
      );
    }

    if (violatedRuleIds.length > 0) {
      ops.push(
        tx.insert(ruleViolations)
          .values(violatedRuleIds.map((ruleId) => ({ tradeId: id, ruleId, userId: user.id })))
          .onConflictDoNothing()
      );
    }

    await Promise.all(ops);
    return true;
  });

  console.timeEnd(`[trades/${id.slice(0, 8)}] review PATCH`);

  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

  void refreshStatsForUser(user.id).catch((err) => console.error("[refresh-stats] failed:", err));

  return NextResponse.json({ ok: true });
}
