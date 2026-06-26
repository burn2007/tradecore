import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with: node --env-file=.env.local scripts/audit-db.mjs");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// 1. List all tables and columns
const tables = await sql`
  SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position
`;
console.log("=== TABLES & COLUMNS ===");
const byTable = {};
for (const row of tables) {
  if (!byTable[row.table_name]) byTable[row.table_name] = [];
  byTable[row.table_name].push(`  ${row.column_name} (${row.data_type}, nullable=${row.is_nullable})`);
}
for (const [table, cols] of Object.entries(byTable)) {
  console.log(`\nTable: ${table}`);
  cols.forEach(c => console.log(c));
}

// 2. Check RLS
const rls = await sql`
  SELECT relname, relrowsecurity, relforcerowsecurity
  FROM pg_class
  JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
  WHERE pg_namespace.nspname = 'public' AND relkind = 'r'
  ORDER BY relname
`;
console.log("\n=== RLS STATUS ===");
for (const r of rls) {
  console.log(`  ${r.relname}: rls_enabled=${r.relrowsecurity}, force=${r.relforcerowsecurity}`);
}

// 3. Sample trade
const trade = await sql`SELECT * FROM trades LIMIT 1`;
console.log("\n=== SAMPLE TRADE ===");
if (trade.length > 0) {
  console.log(JSON.stringify(trade[0], null, 2));
} else {
  console.log("  (no trades in DB)");
}

// 4. stats_cache check
const sc = await sql`SELECT * FROM stats_cache LIMIT 3`;
console.log("\n=== STATS_CACHE ROWS ===");
console.log(JSON.stringify(sc, null, 2));
