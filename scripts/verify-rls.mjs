#!/usr/bin/env node
/**
 * RLS verification script.
 *
 * Requires DATABASE_URL_APP to be set to a connection string using the
 * tradecore_app restricted role. If DATABASE_URL_APP is not set, the
 * script exits with a warning (safe to run in environments without it).
 *
 * What it verifies:
 * 1. Cannot read any rows without setting app.current_user_id
 * 2. After setting app.current_user_id = userA, sees only userA rows
 * 3. After setting app.current_user_id = userB, sees only userB rows
 * 4. Cannot read userA rows while impersonating userB
 *
 * Usage:
 *   node scripts/verify-rls.mjs
 *
 * The script creates two test users, inserts one trade each, runs the
 * isolation checks, then deletes the test data (best-effort cleanup).
 */

import { neon } from "@neondatabase/serverless";

const APP_URL   = process.env.DATABASE_URL_APP;
const OWNER_URL = process.env.DATABASE_URL;

if (!APP_URL) {
  console.warn(
    "[verify-rls] DATABASE_URL_APP not set — skipping RLS verification.\n" +
    "Set DATABASE_URL_APP to a connection string using the tradecore_app role to run this check."
  );
  process.exit(0);
}
if (!OWNER_URL) {
  console.error("[verify-rls] DATABASE_URL not set — cannot create test fixtures.");
  process.exit(1);
}

const appSql   = neon(APP_URL);
const ownerSql = neon(OWNER_URL);

const USER_A = "00000000-0000-0000-0000-000000000001";
const USER_B = "00000000-0000-0000-0000-000000000002";

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

async function withContext(sql, userId, query) {
  const [result] = await sql.transaction([
    sql`SELECT set_config('app.current_user_id', ${userId}, false)`,
    query,
  ]);
  return result;
}

// ── Setup ────────────────────────────────────────────────────────────────────
async function setup() {
  console.log("\n[verify-rls] Setting up test fixtures...");

  // Insert minimal user rows (owner connection bypasses RLS)
  await ownerSql`
    INSERT INTO users (id, email, tier, created_at, updated_at)
    VALUES
      (${USER_A}, 'rls-test-a@tradecore.test', 'free', now(), now()),
      (${USER_B}, 'rls-test-b@tradecore.test', 'free', now(), now())
    ON CONFLICT (id) DO NOTHING
  `;

  // Insert one trade per user
  await ownerSql`
    INSERT INTO trades (user_id, symbol, direction, source, entry_at, is_paper_trade, created_at, updated_at)
    VALUES
      (${USER_A}, 'EURUSD', 'long', 'manual', now(), false, now(), now()),
      (${USER_B}, 'GBPUSD', 'short', 'manual', now(), false, now(), now())
    ON CONFLICT DO NOTHING
  `;

  console.log("[verify-rls] Fixtures ready.");
}

// ── Tests ────────────────────────────────────────────────────────────────────
async function runChecks() {
  console.log("\n[verify-rls] Running isolation checks...\n");

  // 1. No context → zero rows
  try {
    const rows = await appSql`SELECT id FROM trades WHERE user_id = ${USER_A}`;
    assert("No context: cannot read trades (RLS blocks all rows)", rows.length === 0);
  } catch {
    assert("No context: query rejected by RLS", true);
  }

  // 2. User A context → sees only own rows
  const rowsA = await ownerSql.transaction([
    ownerSql`SELECT set_config('app.current_user_id', ${USER_A}, false)`,
    appSql`SELECT symbol FROM trades WHERE user_id IN (${USER_A}, ${USER_B})`,
  ]).catch(() => [[], []]);

  // Since we can't mix two connections in one transaction, use app connection only:
  const [, aRows] = await appSql.transaction([
    appSql`SELECT set_config('app.current_user_id', ${USER_A}, false)`,
    appSql`SELECT symbol FROM trades WHERE user_id IN (${USER_A}, ${USER_B})`,
  ]);
  assert("User A context: sees only EURUSD (own trade)", aRows.length === 1 && aRows[0].symbol === "EURUSD");

  // 3. User B context → sees only own rows
  const [, bRows] = await appSql.transaction([
    appSql`SELECT set_config('app.current_user_id', ${USER_B}, false)`,
    appSql`SELECT symbol FROM trades WHERE user_id IN (${USER_A}, ${USER_B})`,
  ]);
  assert("User B context: sees only GBPUSD (own trade)", bRows.length === 1 && bRows[0].symbol === "GBPUSD");

  // 4. Cross-user check — B cannot read A's row directly
  const [, crossRows] = await appSql.transaction([
    appSql`SELECT set_config('app.current_user_id', ${USER_B}, false)`,
    appSql`SELECT id FROM trades WHERE user_id = ${USER_A}`,
  ]);
  assert("Cross-user: User B cannot read User A's trades", crossRows.length === 0);

  // 5. users table isolation
  const [, userRows] = await appSql.transaction([
    appSql`SELECT set_config('app.current_user_id', ${USER_A}, false)`,
    appSql`SELECT id FROM users WHERE id IN (${USER_A}, ${USER_B})`,
  ]);
  assert("users table: User A context sees only own user row", userRows.length === 1 && userRows[0].id === USER_A);
}

// ── Cleanup ──────────────────────────────────────────────────────────────────
async function cleanup() {
  console.log("\n[verify-rls] Cleaning up test fixtures...");
  try {
    await ownerSql`DELETE FROM trades WHERE user_id IN (${USER_A}, ${USER_B})`;
    await ownerSql`DELETE FROM users WHERE id IN (${USER_A}, ${USER_B})`;
    console.log("[verify-rls] Cleanup done.");
  } catch (e) {
    console.warn("[verify-rls] Cleanup failed (manual cleanup may be needed):", e.message);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await setup();
    await runChecks();
  } finally {
    await cleanup();
  }

  console.log(`\n[verify-rls] Results: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
})();
