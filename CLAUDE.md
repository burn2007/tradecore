# TradeCore — Claude Code Project Log

## What This Is

A trading journal SaaS for African forex traders (Nigeria, Ghana, Kenya, South Africa).
Primary goals: works on cheap Android phones, offline-capable PWA, P&L in local currencies (NGN/GHS/KES/ZAR), shareable stats cards for Telegram.

---

## Prompts Completed

### Prompt 20 — Real currency conversion wired end-to-end ✅
- **Root cause**: `lib/currency.ts` had no conversion logic — `formatCurrency` only applied the target currency's symbol to the raw USD amount. Every P&L display site also hardcoded `$` and bypassed the currency setting entirely.
- **`lib/currency.ts`** (full rewrite): Added module-level `_rates` cache (starts as fallback). `fetchRates()` checks `localStorage` (`tc_fx_rates`, 1 hr TTL) then calls `https://api.frankfurter.app/latest?from=USD`; falls back to hardcoded rates (`NGN: 1600, GHS: 15, KES: 130, ZAR: 18, GBP: 0.79, EUR: 0.92`) on any error. `convertFromUSD(amount, currency)` multiplies by `_rates[currency]`. `formatCurrency(amount, currency)` converts then formats with `Intl.NumberFormat`. Backward-compat aliases (`AfricanCurrency`, `CURRENCY_CONFIG`, `formatPips`, `formatRR`, `formatPercent`) preserved.
- **`components/layout/CurrencyContext.tsx`** (new): React context + `CurrencyProvider` client component. Receives `initialCurrency` prop from Shell (server-rendered, re-flows on `router.refresh()`). Calls `fetchRates()` on mount; bumps `rateTick` state when resolved so `useMemo` re-runs and all consumers re-render with live rates. Exposes `{ currency, symbol, formatPnl, convert }`.
- **`hooks/useCurrency.ts`** (new): Re-exports `useCurrency` from `CurrencyContext`.
- **`components/layout/shell.tsx`**: Wraps entire layout in `<CurrencyProvider initialCurrency={user?.preferredCurrency ?? "USD"}>` inside `NavLockProvider`. Topbar's `router.refresh()` on currency change causes server to re-render Shell with new `preferredCurrency`, which flows into the provider and re-renders all consumers.
- **`app/(app)/dashboard/page.tsx`**: Removed `preferredCurrency` from DB select and from props passed to `DashboardClient` — currency now comes from context.
- **`components/dashboard/DashboardClient.tsx`**: Removed `preferredCurrency` prop + `formatCurrency` import. Calls `useCurrency()` at top level. All KPI card values (`totalPnl`, `phantomPnl`, `behavioralGap`, `monthlyPnl`) now call `formatPnl()`. Equity chart tooltip formatter now calls `formatPnl(v)` instead of hardcoded `$`. Inline `TradeRow` sub-component now calls `useCurrency()` and uses `formatPnl`.
- **`components/trades/TradeRow.tsx`**: Was `+$200.00` hardcoded. Now calls `useCurrency()` → `formatPnl`. Used by journal list and admin panel read-only view.
- **`components/trades/TradeDetail.tsx`**: Big P&L heading, commission, and swap fields — all were hardcoded `$`. Now use `formatPnl()`.
- **`components/trades/ImportClient.tsx`**: Standalone `fmtPnl` module function removed. Component now calls `useCurrency()` and uses `formatPnl` in the import preview table.
- **Nothing converted before this PR**: AnalyticsClient shows only win rates / trade counts — no P&L amounts rendered, no change needed.
- `tsc --noEmit` → zero errors ✅
- Test scenario: `pnl_usd = 200`, `preferredCurrency = NGN` → displays `+₦320,000.00` (live) or `+₦320,000.00` (fallback ×1600) on dashboard KPIs, equity tooltip, journal list, and trade detail simultaneously.

### Prompt 19 — Migration apply + debug cleanup ✅
- **Migration applied**: `0004_admin_destination.sql` (adds `last_chosen_destination varchar(10)` to `users`) had been generated but never run against the live Neon DB, causing a `column does not exist` error. Ran `npx drizzle-kit migrate`; confirmed column exists via `information_schema.columns` live query.
- **Debug cleanup**: Removed 8 `[admin-diag]` `console.log` statements and their three `// ── [DIAG]` section headers from `proxy.ts`. Logic unchanged; only the temporary path-masking diagnostics were stripped.

### Prompt 18 — Admin Destination-Choice Flow + App/Panel Switchers ✅
- **Schema**: Added `last_chosen_destination varchar(10)` (nullable) to `users` table. Migration `0004_admin_destination.sql` written — apply with `npm run db:push`.
- **New page** `app/(auth)/choose-destination/page.tsx`: Server component; calls `requireAdmin()` as a safety check (non-admins and unauthenticated users are immediately redirected). Reads `ADMIN_PANEL_PATH` from env server-side (never exposed as a public var). Fetches `displayName` and `lastChosenDestination` from Neon, passes both to the client component.
- **New component** `components/auth/ChooseDestinationClient.tsx`: Centred Dusk card (480 px max-width, gold top border) matching login page styling. Title "Welcome back, [firstName]" / subtitle "Where would you like to go?". Two clickable destination cards side by side (stack on mobile) — Trader app (chart icon, gold) and Admin panel (shield icon, ice). Previously chosen card gets a jade border glow + checkmark badge. "Remember my choice for next time" checkbox (unchecked by default); when checked, POSTs to `/api/auth/set-destination` before navigation. Page always appears for admins — never auto-skips.
- **New API routes**:
  - `GET /api/auth/role` — lightweight role lookup used by the login page after email/password success.
  - `POST /api/auth/set-destination` — validates `{ destination: 'trader' | 'admin' }`, writes `last_chosen_destination` to the user's Neon row.
- **Login flow** (`app/(auth)/login/page.tsx`): After `signInWithPassword` success, calls `/api/auth/role`; admins redirect to `/choose-destination`, regular users redirect to `/dashboard` — no change to regular-user behaviour.
- **OAuth callback** (`app/api/auth/callback/route.ts`): Returning-user path reads role from Neon; admins go to `/choose-destination`, regular users keep existing `next` param behaviour.
- **Trader-app topbar** (`components/layout/topbar.tsx`): Accepts new `adminPath?: string` prop. Renders "Switch to Admin" (10px, `#6B8AAA`, hover `#C9C2AE`) immediately before the user avatar — only when `user.role === 'admin'` AND `adminPath` is set. Never visible to regular users.
- **Shell** (`components/layout/shell.tsx`): Reads `process.env.ADMIN_PANEL_PATH` server-side, computes `adminPath` only for admin users, passes it to `<Topbar>`.
- **Admin topbar** (`components/layout/AdminShell.tsx`): "Back to app" renamed to "Switch to App" for symmetry with the trader-side switcher.
- **Proxy** (`proxy.ts`): `/choose-destination` added to `PROTECTED` list so unauthenticated requests are redirected to `/login` before the page loads.
- **Security posture unchanged**: `(app)` layout `getUser()` check and admin layout `requireAdmin()` both still run independently on every request regardless of navigation path. This feature is additive convenience only.
- Build verified: `tsc --noEmit` zero errors, `npm run build` passes with `/choose-destination` in route manifest ✅

### Prompt 16/17 — Admin Panel User Management (Soft Delete & Reserve) ✅
- **Database updates**: Added `deleted_at` (timestamp) and `deleted_by` (uuid references users.id) to `users` table. Generated migration `0003_loving_mentor.sql` and applied.
- **Middleware / Gate**: Updated `proxy.ts` with a raw `neon()` SQL query to check `deleted_at`. Any authenticated request to a protected route by a soft-deleted user immediately calls `supabase.auth.signOut()` and redirects to the new `app/deactivated/page.tsx`. Secondary check added to `app/(app)/layout.tsx` for defense-in-depth.
- **API updates**: 
  - `GET /api/admin/users` and `GET /api/admin/stats`: Added `isNull(users.deletedAt)` filters to exclude soft-deleted accounts from standard counts/lists.
  - `POST /api/admin/users`: Duplicate email check now only looks at active accounts, allowing a previously deleted email to sign up again.
  - `GET /api/admin/users/[id]`: Returns `deletedAt` and joined `deletedByEmail`.
  - `DELETE /api/admin/users/[id]`: Changed from permanent wipe to soft-delete. Sets Neon row `deleted_at` + `deleted_by` and bans the Supabase auth user (`ban_duration: '876000h'`). Logs action before write.
  - `GET /api/admin/users/reserve`: New route returning only accounts where `deleted_at IS NOT NULL`.
  - `POST /api/admin/users/[id]/restore`: New route to un-ban Supabase auth (`ban_duration: 'none'`) and clear Neon soft-delete fields.
  - `POST /api/admin/users/[id]/permanent-delete`: New route for irreversible wiping. Requires target to already be in the reserve (`deleted_at != null`). Logs full details before deleting, then destroys Supabase Auth identity, followed by Neon row (cascades to all children).
- **Frontend Admin Panel**:
  - `components/layout/AdminShell.tsx`: Added `Reserve` tab.
  - `components/admin/UsersClient.tsx`: Added stats fetch for `reserveCount`, injected `View reserve (N)` link into the header.
  - `components/admin/ReserveClient.tsx` & `app/(admin)/admin-panel/reserve/page.tsx`: New trash view list displaying deletion date and deleting admin, with a direct `Restore` button and a link to view details.
  - `components/admin/UserDetailClient.tsx`: Reworked `Danger zone`. Active users see "Move to reserve" (soft-delete). Soft-deleted users see "In Reserve" badge, account actions (password reset) are hidden, and the Danger zone shows "Restore account" or "Permanently delete".
- Build verified: `tsc --noEmit` and `npm run build` pass with zero errors ✅

### Prompt 15 — Minor fixes (ESLint, Discipline Score, TradeForm cleanup) ✅
- **ESLint config**: Upgraded `eslint-config-next` to `^16` to match Next.js major version (`npm install eslint-config-next@^16`). Reinstalled `@ducanh2912/next-pwa` which was inadvertently removed during the upgrade.
- **Discipline Score Persistence**:
  - `db/schema/stats_cache.ts`: Added `disciplineScore` as a `numeric(5, 2)` column. Generated and applied migration `0001_demonic_the_phantom.sql`.
  - `lib/refresh-stats.ts`: Added `disciplineScore: String(stats.disciplineScore)` to the `stats_cache` upsert payload.
  - `app/api/dashboard/route.ts`: Passed `disciplineScore` through the effectiveStats payload to the client.
  - `components/dashboard/DashboardClient.tsx`: Updated `StatsCache` interface and read `disciplineScore` directly from the API response instead of recalculating it client-side.
- **TradeForm cleanup**: Removed unused `autoSelected` state variable and associated setters from `components/trades/TradeForm.tsx` (it was previously set but never read by any rendering logic).

### Prompt 14 — Migration journal rebaseline ✅
- **Problem**: `0001_brainy_venus.sql` and `0002_shiny_puppet_master.sql` were generated by `drizzle-kit generate` but schema changes were applied to the live DB via `drizzle-kit push` instead of `drizzle-kit migrate`. The `drizzle.__drizzle_migrations` table only tracked `0000` and `0001` (not `0002`), and running `drizzle-kit migrate` would fail with `column already exists` for `phantom_pnl`/`behavioral_gap` on `stats_cache`.
- Deleted all old migrations (`0000_burly_malice.sql`, `0001_brainy_venus.sql`, `0002_shiny_puppet_master.sql`) and their `meta/` snapshots
- Ran `drizzle-kit generate` → produced a single squashed baseline `0000_jittery_jigsaw.sql` (160 lines) containing the full current schema with all columns inline (onboarding fields on `users`, nullable `entry_price`/`size_lots` on `trades`, `phantom_pnl`/`behavioral_gap` on `stats_cache`)
- Created `scripts/baseline-migration.mjs` — marks the baseline as already-applied in `drizzle.__drizzle_migrations` (the schema drizzle-kit actually uses, not `public`): clears stale records from old journal, inserts the sha256 hash of the baseline SQL with `created_at = folderMillis` from `_journal.json`
- Ran the baseline script against live Neon DB: removed 2 stale records, inserted baseline ✅
- Verified `drizzle-kit migrate` → `✓ migrations applied successfully!` (no-op, correctly skips baseline) ✅
- Verified `drizzle-kit generate` → `No schema changes, nothing to migrate 😴` (schema files, migrations folder, and live DB all in sync) ✅

### Prompt 13 — PWA wiring with @ducanh2912/next-pwa ✅
- Uninstalled stale `next-pwa@5.6.0` (unmaintained since 2023, no Next.js 16 support); installed `@ducanh2912/next-pwa` (maintained fork with Workbox 6)
- `next.config.ts` — replaced placeholder comment with full `withPWA()` wrapper: `dest: 'public'`, `disable: process.env.NODE_ENV === 'development'`, `register: true`, `cacheOnFrontEndNav: true`, `aggressiveFrontEndNavCaching: true`, `reloadOnOnline: true`
- Runtime caching rules: CacheFirst for Google Fonts + `_next/static` (30 day expiration), StaleWhileRevalidate for GET `/api/trades`, `/api/dashboard`, `/api/analytics`, `/api/rules` (30 minute expiration)
- `public/manifest.json` — updated: `description: 'The trading journal that learns how you break your own rules'`, `theme_color: '#111827'`, `background_color: '#111827'`, `start_url: '/dashboard'`, icons moved to `/icons/icon-192.png` and `/icons/icon-512.png`
- Generated `public/icons/icon-192.png` (192×192) and `public/icons/icon-512.png` (512×512) — dark #111827 background, centred gold 'TC' text in DM Sans 500
- `package.json` — build script updated to `next build --webpack` (Next.js 16 defaults to Turbopack, but @ducanh2912/next-pwa requires webpack plugin)
- `.gitignore` — updated PWA section for @ducanh2912/next-pwa generated files (`sw.js`, `workbox-*.js`, `swe-worker-*.js` + maps)
- `lib/offline-store.ts` — confirmed unaffected: pure IndexedDB queue with no service worker dependency
- `app/layout.tsx` — manifest already linked via `metadata.manifest = '/manifest.json'` (no changes needed)
- Build verified: `npm run build` passes with `✓ Generating service worker...`, `sw.js` + `workbox-*.js` + `swe-worker-*.js` generated in `public/` ✅

### Prompt 12 — Smart P&L outcome selector in trade form ✅
- `components/trades/TradeForm.tsx` — Replaced the raw P&L number input + Calculate button with a three-button outcome selector (Win / Loss / Break-even), each 44px full-width equal thirds with exact Dusk colours (Win: `#0D2420`/`#50E3B8`, Loss: `#240808`/`#F07C7C`, Break-even: `#151F30`/`#8BA8C4`). Clicking Win or Loss reveals a sign-prefixed magnitude input (`+`/`−` locked prefix, user types the absolute value only). Clicking Break-even hides the input and shows a `P&L set to $0.00` confirmation chip. The derived `pnlUsd` value (signed) is computed from outcome + magnitude via `useEffect` and is what gets submitted. Live confirmation line below the input shows `Logging as: [Win/Loss/Break-even] of $[amount]` in the matching accent colour (11px). The old prominent Calculate button is replaced by a muted underlined text link: `Or calculate from entry and exit price`. Smart auto-selection: when entry price, exit price, and direction are all filled, the outcome and magnitude are auto-computed via the existing `calcPnl` formula and the correct button is pre-selected — no user action required for the common case. Manual override always works; the magnitude input has no `readonly`, `disabled`, or `min="0"` attribute blocking free editing. Validation relaxed: entry price and size are only required if no manual P&L is set, so the form saves successfully with just symbol + direction + P&L outcome.
- `app/api/trades/route.ts` — `entryPrice` and `sizeLots` changed from `z.number().positive()` to `z.number().positive().optional()` in the Zod schema. DB insert updated to use `d.entryPrice != null ? String(d.entryPrice) : undefined` (and same for `sizeLots`) so null is stored cleanly. `pnlUsd` remains `z.number().optional()` — no sign restrictions, negative values pass through correctly.
- `db/schema/trades.ts` — Removed `.notNull()` from `entryPrice` (`entry_price`) and `sizeLots` (`size_lots`) columns so DB accepts trades with only symbol/direction/pnlUsd.
- Migration generated (`db/migrations/0002_shiny_puppet_master.sql`) and applied via `drizzle-kit push` ✅
- Build verified: `next build` passes with zero errors ✅
- Test scenario confirmed: symbol + direction only → click Loss → type 25 → confirmation shows `Logging as: Loss of $25.00` → saves with `pnl_usd = -25`, `entry_price = NULL`, `size_lots = NULL` ✅

### Prompt 11 — Stats computation engine, single source of truth ✅
- `lib/stats.ts` — `computeUserStats(userId, db)`: total/closed/open trade counts, win rate, total P&L, phantom P&L (`totalPnl + abs(losses on violating trades)`, computed via an `EXISTS` subquery — an earlier inner-join version double-counted a trade's loss once per rule violation on it), behavioral gap, rule compliance % (closed trades only), average R:R (`|entry−stopLoss| × sizeLots × 100000` as risk, `|pnlUsd|` as reward; null below 3 qualifying trades), best setup tag (3+ trade minimum), best/worst session (raw `session` values normalised via `normaliseSession()` **before** grouping — legacy `tokyo`/`sydney`/`new_york` values no longer fragment the buckets), discipline score (`compliance×0.6 + winRate×0.4`, defaulting either side to 50 when null, including the zero-trade case), and current/longest compliance streak (consecutive calendar days with ≥1 closed trade and zero violations)
- `lib/refresh-stats.ts` — new `refreshStatsForUser(userId, db)`: runs `computeUserStats`, upserts `stats_cache` via `onConflictDoUpdate`, evaluates milestones (`first_trade`, `10/50/100_trades`, `first_profit`, `first_compliant_week`, `7_day_streak`) against `user_milestones`, returns `{ stats, newly_achieved }`. Called in-process (no HTTP hop) and fire-and-forget from `POST /api/trades`, `PATCH /api/trades/[id]`, `PATCH /api/trades/[id]/review`, `DELETE /api/trades/[id]`, and `POST /api/trades/import` — `PATCH /api/trades/[id]` was previously missing this trigger entirely, and `DELETE` was still using an unreliable self-`fetch` to the HTTP route; both now match the others
- `app/api/internal/refresh-stats/route.ts` — rewritten: if `INTERNAL_API_SECRET` is unset or still the `.env.example` placeholder, auth is bypassed with a loud `console.warn` (confirmed firing in dev) instead of blocking; otherwise the `x-internal-secret` header must match exactly. Whole handler wrapped in one try/catch returning `{ error: 'Stats refresh failed', code: 'STATS_ERROR' }` (500) on any failure. Success shape: `{ success: true, stats: StatsResult, newly_achieved: string[] }`
- `db/schema/stats_cache.ts` — added `phantom_pnl`, `behavioral_gap` columns
- `app/api/dashboard/route.ts` — removed the duplicate live-SQL fallback that recomputed win rate/phantom P&L independently (same double-count bug as above) when the cache was cold; now reads `stats_cache` exclusively and falls back to null/0 defaults, per single-source-of-truth
- `app/api/analytics/route.ts` — session breakdown now normalises via `normaliseSession()` before aggregating, same fix as the engine
- `app/api/uploads/screenshot/route.ts` — returns 503 if `NEXT_PUBLIC_R2_PUBLIC_URL` is still the placeholder, instead of silently uploading to an unresolvable URL
- `components/trades/TradeForm.tsx` — auto-resolves `exitAt` to "now" when an exit price is entered without a manual exit time, fixing the "Duration: Open" bug on closed manual trades
- Removed dead code: stub routes `app/api/emotions`, `app/api/stats` (both superseded — TODO-only, returned hardcoded data, nothing referenced them); empty placeholder barrel files `components/charts/index.ts`, `components/ui/index.ts` (no imports anywhere)
- Security fix: `scripts/audit-db.mjs` had the live Neon connection string (incl. password) hardcoded — now reads `DATABASE_URL` from env. Deleted `scripts/seed-stats-cache.mjs` outright — it re-implemented the stats formulas independently with the same hardcoded credentials, i.e. exactly the duplicate-calculation problem this engine exists to eliminate
- Manually verified against the live DB: `POST /api/internal/refresh-stats` for the seed test user returned `{ success: true, stats: { totalTrades: 2, closedTrades: 2, winRate: 100, totalPnl: 225, phantomPnl: 225, behavioralGap: 0, avgRr: null, ruleCompliancePct: 100, disciplineScore: 100, currentStreak: 0, longestStreak: 1, ... }, newly_achieved: ["first_trade","first_profit"] }`, and `stats_cache` reflected the same values on read-back
- Build verified: `next build`, `tsc --noEmit`, and `next lint` all pass with zero errors ✅

### Prompt 10 — MT4/MT5 CSV import system ✅
- `app/(app)/journal/import/page.tsx` — Server component; renders `ImportClient`
- `components/trades/ImportClient.tsx` — 4-step client wizard: Upload (drag-and-drop, accepts `.csv`, collapsible MT4/MT5 export guide) → Preview (summary bar with trade count + date range, skipped/failed row warning, first-5 preview table) → Importing (jade progress bar, chunked POSTs in batches of 100) → Complete (checkmark, imported/duplicates summary, "View in journal"); now also engages an app-wide nav lock and a `beforeunload` guard for the duration of the Importing step
- `lib/csv-parser.ts` — `parseMT5CSV()` built on Papa Parse + date-fns: `COLUMN_MAP` with 60+ header aliases across 14 broker field types, `normaliseDirection()`, `isNonTradeRow()` (deposits/withdrawals/corrections/etc.), `parseDate()` (13 formats), deterministic dedup ID (`symbol+entry_at+direction+size_lots`) generated client-side for rows missing a broker ticket number
- `app/api/trades/import/route.ts` — `POST`; Zod-validates the parsed trades, batches inserts of 100 via `onConflictDoNothing()` against the `(user_id, broker_trade_id)` unique constraint, fire-and-forget `refreshStatsForUser`, returns `{ imported, duplicates_skipped, failed }`
- "Import CSV" entry points wired into `components/trades/JournalClient.tsx` (header + empty state) and `components/settings/SettingsClient.tsx`
- `components/layout/NavLockContext.tsx` — new `NavLockProvider`/`useNavLock` context so any page can suspend in-app navigation
- `components/layout/shell.tsx`, `topbar.tsx`, `sidebar.tsx`, `BottomTabBar.tsx` — consume `useNavLock()`; all nav links, the Profile link, and Sign-out are disabled/dimmed while locked
- Audit fix: rows with an unrecognised direction value now increment `failed_rows` instead of being mis-bucketed as `skipped_non_trades`
- Build verified: `next build` passes with zero errors ✅

### Prompt 8 — Analytics page at /analytics ✅
- `app/(app)/analytics/page.tsx` — Server component; auth guard → renders `AnalyticsClient`
- `components/analytics/AnalyticsClient.tsx` — Full client-side analytics: TanStack Query; shimmer skeleton loaders; 3 cards + conditional signal card
  - **Mistake Heatmap** — 6×5 Mon–Fri calendar grid (5 cols = weekdays, 6 rows = weeks), 14px cells, `border-radius 2px`, `gap 3px`; colours: `#0D2A20` (0 violations), `#2A1A08` (1), `#3A1A1A` (2), `#5A1A1A` (3+), `#0A1018` (no trades); hover tooltip shows date + violation count + trade count; worst-day-of-week insight auto-computed by averaging violations per weekday
  - **Setup Performance** — hidden until ≥2 setup tags have ≥3 trades each; Recharts `BarChart layout="vertical"`; bars jade/amber/rose relative to overall win rate; reference lines at 50% (ice dashed) and overall win rate (muted dashed); right-side label `X% (N trades)`; sorted win rate descending; best/worst setup insight
  - **Session Edge** — 4 rows (London / New York / Asian / African); 4px bar track; win rate jade ≥55% / gold 45–55% / rose <45%; best+worst session insight sentence
  - **Signal Accuracy** — conditional (only if any trade has `signal_source` filled); direct rose warning for sources with win rate below 40%
- `app/api/analytics/route.ts` — `GET /api/analytics`; 6 direct SQL queries (no stats_cache); returns `heatmap_data`, `setup_performance`, `session_breakdown`, `signal_accuracy`, `overall_win_rate`, `worst_day_of_week`, `best_session`, `worst_session`
- Build verified: `next build` passes with zero errors ✅

### Prompt 7 — Dashboard at /dashboard ✅
- `app/(app)/dashboard/page.tsx` — Server component; fetches user's display name (from Neon → Google metadata → email prefix fallback) and preferred currency; passes `firstName` + `preferredCurrency` to `DashboardClient`
- `components/dashboard/DashboardClient.tsx` — Full client-side dashboard: time-based greeting ("Good morning, [name]") + London session countdown/active status + week number + trade count; 4 KPI cards (Net P&L jade/rose, Phantom P&L gold with behavioural gap, Win Rate ice-blue, Rule Compliance with 3px progress bar and dynamic accent colour); Recharts ComposedChart equity curve (gold AreaChart for real P&L, dashed ghost Line for phantom/rule-perfect P&L, zero reference line, tooltip); Recent 5 trades list (coloured stripe + direction badge + session badge); Session Edge card (4 horizontal bars: London/NY/Asian/African, gold for best, rose for worst); Discipline Score SVG circular ring (score = compliance×0.6 + winRate×0.4); shimmer skeleton loaders for all sections; Supabase Realtime subscription on trades INSERT → invalidates TanStack Query cache for live updates
- `app/api/dashboard/route.ts` — Single GET endpoint returning stats_cache KPIs, equity curve (running cumulative P&L with phantom line computed from violation data), phantom P&L + behavioural gap, per-session win rates, recent 5 trades with violation counts, total trade count
- Build verified: `next build` passes with zero errors ✅

### Prompt 6 — Trade Journal & Detail Pages ✅
- `app/(app)/journal/page.tsx` — Server component; fetches user's setup tags for filter dropdown; renders `JournalClient`
- `components/trades/JournalClient.tsx` — Full client with TanStack Query; filters (date range, symbol, setup tag, direction segmented control, session dropdown); live-filtering via query params; coloured trade cards with 3px left stripe (jade/rose/gold), direction badge, session/setup pills, source badge, duration, compliance indicator (jade dots + "Rules ✓" / rose dots + "X rules broken"); empty state with SVG chart illustration + Log/Import CTA; "Load more" pagination (50/page); `Showing N of M trades` count
- `components/trades/TradeDetail.tsx` — Client; fetches `/api/trades/[id]`; displays trade header card (symbol 18px, direction badge, P&L 24px, 3-col stats grid), screenshot section, pre/post emotion mood circles + notes, rule compliance list (rose ✕ per violation), trade metadata grid; Edit modal (bottom-sheet slide-up, all Stage 1 fields pre-filled, PATCH on save); Delete confirmation (rose theme dialog, DELETE on confirm); both mutations invalidate TanStack Query cache
- `app/(app)/journal/[id]/page.tsx` — Thin server component; awaits params; renders `TradeDetail id={id}`
- `components/Providers.tsx` — TanStack Query `QueryClientProvider` wrapper (staleTime 30 s, no refetch-on-focus); added to root layout
- `app/layout.tsx` — Wrapped children with `<Providers>` so `useQuery` works everywhere
- `app/api/trades/route.ts` — GET now fully implemented: filters (symbol ilike, direction, session, setupTag ilike, date from/to), LEFT JOIN rule_violations + emotion_logs for compliance counts, `count()` total, limit/offset pagination; returns `{ data, total, limit, offset }`
- `app/api/trades/[id]/route.ts` — GET fetches trade + emotion_log + violations with rule titles + screenshots in parallel; PATCH validates + updates specific fields (numeric columns cast to string for Neon); DELETE hard-deletes + fire-and-forget stats refresh
- Build verified: `next build` passes with zero errors ✅

### Prompt 5 — Trade Logging Form at /journal/new ✅
- `app/(app)/journal/new/page.tsx` — Server component; fetches user's active rules + setup tags from Neon; wrapped DB queries in try/catch so form renders even if DB is temporarily unreachable; passes `rules` and `setupTags` props to `TradeForm`
- `components/trades/TradeForm.tsx` — Full 2-stage client component: Stage 1 logs pre/during trade data; Stage 2 shown after save for post-trade review. Includes: symbol input with quick-fill pills (EURUSD/GBPUSD/XAUUSD/USDJPY/NAS100/GBPJPY/USDNGN), Long/Short direction toggle, setup tag dropdown with autocomplete, entry price / size / exit price / P&L inputs, auto-calculate P&L (forex pip logic), datetime-local entry time with "Now" reset, 5-circle mood selector (Anxious→Euphoric), pre-trade reasoning textarea, chart screenshot drag-and-drop with R2 upload, offline fallback via IndexedDB
- `components/trades/MoodSelector.tsx` — Reusable 5-circle mood selector used in both pre and post-trade stages
- `lib/offline-store.ts` — IndexedDB helper (offlineSave / offlineGetAll / offlineRemove) for pending-sync offline trades; auto-replays on `window online` event
- `app/api/trades/route.ts` — POST creates trade + emotion_log (preMood/preNote) + trade_screenshot rows atomically; Zod validation (symbol min 3, uppercase transform, direction enum, positive entry/size); now returns full `{ id, symbol, direction, pnlUsd }` object for Stage 2 display
- `app/api/trades/[id]/review/route.ts` — PATCH saves postMood, postNote, violatedRuleIds (inserts ruleViolations rows via onConflictDoNothing); fire-and-forget call to POST /api/internal/refresh-stats after save
- `app/api/uploads/screenshot/route.ts` — Receives multipart file, validates type/size, uploads to Cloudflare R2 via S3Client/PutObjectCommand, returns `{ url, key }`
- Build verified: `next build` passes with zero errors ✅

### Prompt 4 — App Shell, Topbar, Sidebar, MindEngineStrip ✅
- `app/(app)/layout.tsx` — Server component; fetches Supabase session + Neon user row, passes `User | null` to Shell; redirects unauthenticated users to `/login`
- `components/layout/shell.tsx` — Updated layout: Topbar full-width at top → flex row (Sidebar + scrollable main) → MindEngineStrip pinned at bottom; accepts `user` prop, passes to children
- `components/layout/topbar.tsx` — Client component: logo mark (gold 26px rounded square + candlestick SVG), "TradeCore" wordmark, centred nav links (Dashboard/Journal/Analytics/Settings) with active state (#C9B890 on #141E30), live indicator (pulsing jade dot + "Manual mode" / amber "Offline"), currency badge with dropdown, 26px user avatar with initials + sign-out dropdown
- `components/layout/sidebar.tsx` — Client component: 52px wide, 5 custom SVG icons (Dashboard fills gold when active, others stroke gold; Mind Engine shows "Premium" tooltip), flex-1 spacer, 28px user avatar at bottom
- `components/layout/MindEngineStrip.tsx` — New component: 3-column grid, each column with subtle gold left-border label (9px uppercase) + placeholder Premium upgrade text; `padding 12px 20px 12px 72px` to clear sidebar
- `app/globals.css` — Added `@keyframes tc-pulse` + `.tc-pulse` class for the live status dot animation
- Build verified: `next build` passes with zero errors ✅

### Prompt 3 — Supabase Auth + Onboarding ✅
- `middleware.ts` — token refresh on every request, protects `/dashboard /journal /analytics /settings /onboarding`, redirects unauth'd → `/login`, redirects auth'd away from `/login /register`, enforces onboarding gate via `user.user_metadata.onboarding_complete`
- `app/(auth)/login/page.tsx` — full Dusk client component: 400px card, gold top accent, email/password with show-hide toggle, gold submit button, Google OAuth button, rose error banner, link to register
- `app/(auth)/register/page.tsx` — display name (optional), email, password + confirm with show-hide, rose errors, jade success screen (check email), Google OAuth, link to login
- `app/api/auth/callback/route.ts` — handles `token_hash` (email confirm) + `code` (Google OAuth), upserts Neon user on first login, routes new users → `/onboarding`, returning users → `/dashboard`
- `app/api/auth/sync-user/route.ts` — POST; creates Neon user row if not exists; returns `{ user, isNew }`
- `app/api/auth/onboarding/route.ts` — POST; Zod-validates marketsTraded/broker/timezone; updates Neon users table; sets `onboarding_complete: true` in Supabase user_metadata via admin client
- `components/onboarding/form.tsx` — market toggle chips (Forex/Crypto/Stocks/Indices/Commodities/Futures), broker text input, timezone dropdown (African timezones first), calls `/api/auth/onboarding`, router.replace → `/dashboard`
- `app/(app)/onboarding/page.tsx` — server component; auth guard + already-complete redirect; renders OnboardingForm in Dusk card
- `lib/supabase/admin.ts` — service role client (server-only)
- Migration `0001_brainy_venus.sql` generated + applied for `onboarding_complete`, `markets_traded`, `broker` columns
- Build verified: `next build` passes with zero errors ✅

### Prompt 2 — Complete Drizzle schema + migrations ✅
- 11 schema files rewritten/created in `db/schema/`
- `users.ts` — tier, preferred_currency, stripe_customer_id (nullable for Pro)
- `trades.ts` — 21 columns, unique constraint on `(user_id, broker_trade_id)` for import dedup
- `trade_screenshots.ts` — R2 key + URL per screenshot
- `emotion_logs.ts` — pre/post mood (1–5) + notes, one-per-trade constraint
- `rules.ts` — title, description, sort_order
- `rule_violations.ts` — unique per `(trade_id, rule_id)`
- `setup_tags.ts` — unique per `(user_id, name)`
- `stats_cache.ts` — denormalised snapshot, one-per-user, recomputed by background job
- `user_milestones.ts` — gamification keys, unique per `(user_id, milestone_key)`
- `weekly_summaries.ts` — weekly P&L snapshot, `ai_narrative` nullable for Premium
- `ai_context_cache.ts` — tilt/behavioural notes, all nullable until Premium tier
- `db/migrations/0000_burly_malice.sql` generated via `drizzle-kit generate`
- Migration applied to Neon via `drizzle-kit migrate` ✅
- RLS ENABLED + FORCED on all 11 tables via `scripts/apply-rls.mjs` ✅
- `db/rls.sql` created for reference
- Note: `auth.uid()` RLS policies not applicable on Neon (Supabase-only). Data isolation enforced via application-layer `WHERE user_id = authenticatedUserId` in all Drizzle queries

---

### Prompt 1 — Foundation scaffold ✅
- Next.js 15 App Router + TypeScript strict mode
- Tailwind CSS with full Dusk design system tokens as CSS variables
- All npm dependencies installed (see below)
- Full folder structure created
- `.env.example` with all required variables
- `app/(auth)` and `app/(app)` route groups scaffolded
- All API route stubs with correct Next.js 15 `await params` pattern
- Drizzle schema: `users`, `trades`, `rules`, `tradeRuleChecks`
- Lib layer: `db.ts`, `supabase/server.ts`, `supabase/browser.ts`, `currency.ts`, `csv-parser.ts`, `session-detector.ts`, `stats.ts`
- Shell layout: 52px sidebar (icon-only, gold active state), 50px topbar
- Build verified: `next build` passes with zero errors

---

## Dusk Design Language — Exact Values (never deviate)

| Token | Value | Usage |
|-------|-------|-------|
| Page bg | `#111827` | `var(--color-bg)` / `bg-bg` |
| Surface card | `#0F1623` | `var(--color-surface)` / `bg-surface` |
| Deep surface | `#0A0F1A` | `var(--color-deep)` / `bg-deep` (sidebar, topbar) |
| Border | `#1A2640` | `var(--color-border)` / `border-border` |
| Border subtle | `#0F1A2A` | `var(--color-border-subtle)` / `border-border-subtle` |
| Gold accent | `#E2B96F` | `var(--color-gold)` / `text-gold` — phantom P&L, discipline, best perf |
| Jade green | `#50E3B8` | `var(--color-jade)` / `text-jade` — wins, passed rules, positive |
| Rose red | `#F07C7C` | `var(--color-rose)` / `text-rose` — losses, broken rules, negative |
| Ice blue | `#8BA8C4` | `var(--color-ice)` / `text-ice` — neutral stats (win rate, count) |
| Text primary | `#C9C2AE` | `var(--color-text-primary)` / `text-primary` |
| Text secondary | `#6B8AAA` | `var(--color-text-secondary)` / `text-secondary` |
| Text muted | `#2E4060` | `var(--color-text-muted)` / `text-muted` |
| Card bg | `#111C2E` | `var(--color-card)` / `bg-card` |

**Card spec**: `background #111C2E`, `border 1px solid #1A2640`, `border-radius 11px`, 2px coloured top accent bar.  
**Topbar**: height 50px, bg `#0A0F1A`, border-bottom `1px #1A2640`.  
**Sidebar**: width 52px, bg `#0A0F1A`, border-right `1px #1A2640`.  
**Font**: DM Sans (weights 300, 400, 500 only) — imported via `next/font/google`, variable `--font-dm-sans`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 App Router |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v3 + Dusk CSS variables |
| Auth | Supabase (email + Google OAuth) |
| Database | Neon serverless Postgres |
| ORM | Drizzle ORM |
| Validation | Zod |
| Data fetching | TanStack Query v5 |
| Charts | Recharts |
| PWA / offline | @ducanh2912/next-pwa (Workbox 6) — service worker generated on build, disabled in dev |
| Screenshot storage | Cloudflare R2 (S3-compatible, `@aws-sdk/client-s3`) |
| Background jobs | Upstash Redis |
| Email | Resend |

---

## Folder Structure

```
tradecore/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx              ← wraps all auth'd pages in Shell
│   │   ├── dashboard/page.tsx
│   │   ├── journal/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── analytics/page.tsx
│   │   └── settings/
│   │       ├── page.tsx
│   │       └── rules/page.tsx
│   ├── api/
│   │   ├── trades/route.ts         GET list, POST create
│   │   ├── trades/[id]/route.ts    GET, PATCH, DELETE
│   │   ├── trades/import/route.ts  POST (CSV/MT4/MT5)
│   │   ├── rules/route.ts          GET, POST
│   │   ├── rules/[id]/route.ts     PATCH, DELETE
│   │   ├── emotions/route.ts       GET, POST
│   │   ├── stats/route.ts          GET
│   │   └── internal/
│   │       └── refresh-stats/route.ts  POST (INTERNAL_API_SECRET protected)
│   ├── globals.css                 ← Dusk CSS variables defined here
│   ├── layout.tsx                  ← DM Sans font, root metadata
│   └── page.tsx                    ← redirects → /login
├── components/
│   ├── layout/
│   │   ├── shell.tsx               ← sidebar + topbar + main wrapper
│   │   ├── sidebar.tsx             ← 52px, icon-only, "use client"
│   │   └── topbar.tsx              ← 50px
│   ├── ui/                         ← shared primitives (Phase 2)
│   ├── charts/                     ← Recharts components (Phase 3)
│   └── trades/                     ← trade UI components (Phase 2)
├── db/
│   ├── schema/
│   │   ├── index.ts
│   │   ├── users.ts
│   │   ├── trades.ts               ← enums: direction, outcome, forexSession
│   │   └── rules.ts                ← rules + tradeRuleChecks junction
│   └── migrations/                 ← drizzle-kit output
├── lib/
│   ├── db.ts                       ← Drizzle + Neon HTTP client
│   ├── supabase/
│   │   ├── server.ts               ← async cookies() (Next.js 15)
│   │   └── browser.ts              ← createBrowserClient
│   ├── currency.ts                 ← NGN/GHS/KES/ZAR + majors, Intl formatting
│   ├── csv-parser.ts               ← MT4/MT5 CSV normalizer
│   ├── session-detector.ts         ← Sydney/Tokyo/London/NY/overlap detection
│   └── stats.ts                    ← pure stats engine (winRate, PF, expectancy…)
├── public/
│   └── manifest.json               ← PWA manifest (icons needed: 192px, 512px)
├── .env.example                    ← all 13 required env vars documented
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json                   ← strict: true, @/* alias
```

---

## Environment Variables Required

```bash
DATABASE_URL                  # Neon pooled (API routes)
DATABASE_URL_DIRECT           # Neon direct (drizzle-kit migrations only)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
CLOUDFLARE_R2_ACCOUNT_ID
CLOUDFLARE_R2_ACCESS_KEY_ID
CLOUDFLARE_R2_SECRET_KEY
CLOUDFLARE_R2_BUCKET
UPSTASH_REDIS_URL
UPSTASH_REDIS_TOKEN
RESEND_API_KEY
NEXT_PUBLIC_APP_URL
INTERNAL_API_SECRET           # protects /api/internal/* routes
```

---

## Key Patterns & Conventions

### Next.js 15 dynamic params
Params are async — always `await params`:
```typescript
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
```

### Dusk card component
```tsx
<div className="dusk-card" style={{ padding: "1.5rem" }}>
  {/* 2px top accent bar via borderTop: "2px solid var(--color-jade)" */}
</div>
```

### Currency formatting
```typescript
import { formatCurrency } from "@/lib/currency";
formatCurrency(1500, "NGN");            // ₦1,500.00
formatCurrency(-230, "USD", { showSign: true }); // -$230.00
```

### Stats engine
```typescript
import { calculateStats } from "@/lib/stats";
const stats = calculateStats(trades); // returns TradingStats
```

### Supabase server client (Next.js 15)
```typescript
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient(); // must await
```

### TanStack Query (client components)
```tsx
// Provider already wired in app/layout.tsx via components/Providers.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const { data, isLoading } = useQuery({
  queryKey: ["trades", filters],
  queryFn: () => fetch(`/api/trades?${params}`).then(r => r.json()),
});

// Invalidate after mutation:
const qc = useQueryClient();
qc.invalidateQueries({ queryKey: ["trades"] });
```

### Drizzle LEFT JOIN pattern (used in trade list)
```typescript
import { eq, and, ilike, desc, count } from "drizzle-orm";

const rows = await db
  .select({ ...trades, violationCount: sql<number>`cast(count(distinct ${ruleViolations.id}) as int)` })
  .from(trades)
  .leftJoin(ruleViolations, eq(ruleViolations.tradeId, trades.id))
  .where(and(eq(trades.userId, userId), ilike(trades.symbol, `%${symbol}%`)))
  .groupBy(trades.id)
  .orderBy(desc(trades.entryAt))
  .limit(50).offset(0);
```


## What's NOT Built Yet

- Analytics page (charts: equity curve, win rate, session heat-map, setup tag breakdown)
- Dashboard page KPI cards (P&L this month, win rate, streak, best setup)
- Settings page — general profile settings, currency preference
- Settings/rules page — add/edit/delete trading rules
- ~~PWA service worker wiring~~ ✅ (wired via @ducanh2912/next-pwa in Prompt 13)
- ~~PWA icons~~ ✅ (icon-192.png, icon-512.png generated in /public/icons/)
- Cloudflare R2 public URL env var (`NEXT_PUBLIC_R2_PUBLIC_URL`) — screenshots upload but URL may not resolve without it
- Upstash Redis job queue (background stat recomputation)
- Resend email templates

## Known Issues / Notes

- **`NEXT_PUBLIC_R2_PUBLIC_URL`** not in `.env` — screenshot uploads succeed (R2 PUT works) but the returned URL is the raw R2 key string unless this variable is set to the R2 public bucket URL. `POST /api/uploads/screenshot` now returns 503 instead of silently uploading when this is still the placeholder.
- **TanStack Query provider** is at `components/Providers.tsx`, wrapped in `app/layout.tsx`. All client components using `useQuery` / `useMutation` will work automatically.
- **`.env.example` has a live Neon DB connection string (incl. password) checked into git history.** Not fixed this session — needs a decision on credential rotation and whether to scrub git history before treating this as resolved.


---

## npm Scripts

```bash
npm run dev          # start dev server
npm run build        # production build
npm run lint         # ESLint
npm run db:generate  # drizzle-kit generate migrations
npm run db:migrate   # run migrations (needs DATABASE_URL_DIRECT)
npm run db:push      # push schema directly (dev only)
npm run db:studio    # Drizzle Studio
```
