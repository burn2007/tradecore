import { type NextRequest, NextResponse } from "next/server";
import { refreshStatsForUser } from "@/lib/refresh-stats";

/**
 * POST /api/internal/refresh-stats
 *
 * HTTP entry point for external callers (cron jobs, webhooks, etc.).
 * Internal trade routes call refreshStatsForUser() directly — no HTTP hop.
 */

const PLACEHOLDER_SECRET = "replace-with-random-32-char-hex-string";

export async function POST(request: NextRequest) {
  try {
    const configuredSecret = process.env.INTERNAL_API_SECRET;
    const isPlaceholder = !configuredSecret || configuredSecret === PLACEHOLDER_SECRET;

    if (isPlaceholder) {
      console.warn(
        "[refresh-stats] WARNING: INTERNAL_API_SECRET is unset or still the placeholder " +
        "value — internal API auth is DISABLED. This is UNSAFE for production; set a real " +
        "secret before deploying.",
      );
    } else {
      const secret = request.headers.get("x-internal-secret");
      if (secret !== configuredSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = (await request.json()) as { userId?: string };
    const { userId } = body;
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const result = await refreshStatsForUser(userId);

    return NextResponse.json({
      success:        true,
      stats:          result.stats,
      newly_achieved: result.newly_achieved.map((m) => m.key),
    });
  } catch (err) {
    console.error("[refresh-stats] error:", err);
    return NextResponse.json(
      { error: "Stats refresh failed", code: "STATS_ERROR" },
      { status: 500 },
    );
  }
}
