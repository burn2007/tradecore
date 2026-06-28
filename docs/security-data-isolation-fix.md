# Security Fix: Cross-User Data Isolation

**Date:** 2026-06-28  
**Severity:** Critical  
**Root cause:** Workbox service worker cached authenticated API responses by URL with no auth context in the cache key. A second user logging in on the same browser received the previous user's cached API responses before the network fetch completed.

---

## What Changed (44 files)

### Fix 1 — Remove authenticated API responses from service worker cache (CRITICAL)

**File:** `next.config.ts`

- Removed `cacheOnFrontEndNav: true` and `aggressiveFrontEndNavCaching: true`
- Removed all 4 `StaleWhileRevalidate` runtime cache entries for API routes: `api-trades`, `api-dashboard`, `api-analytics`, `api-rules`
- Kept only static-safe entries: Google Fonts (`CacheFirst`) and `/_next/static/` (`CacheFirst`)

**Why this was the root cause:** The Workbox service worker Cache API is backed by IndexedDB and survives full page reloads. When User B logged in (even via hard navigation with `window.location.href`), the service worker intercepted requests and returned User A's stale responses for up to 30 minutes before the network fetch returned fresh data.

---

### Fix 2 — TanStack Query cache isolation on logout (HIGH)

**Files:** `components/layout/topbar.tsx`, `components/dashboard/DashboardClient.tsx`, `components/trades/JournalClient.tsx`, `components/analytics/AnalyticsClient.tsx`, `components/trades/TradeDetail.tsx`, `app/(app)/journal/[id]/page.tsx`, `app/(app)/dashboard/page.tsx`, `app/(app)/journal/page.tsx`, `app/(app)/analytics/page.tsx`

- Added `queryClient.clear()` before `window.location.href = "/login"` in the logout handler (topbar)
- Added `userId` to every `useQuery` cache key:
  - `["dashboard", userId]`
  - `["trades", userId, ...filters]`
  - `["analytics", userId]`
  - `["trade", userId, id]`
- All server pages now fetch `user.id` from Supabase auth and pass it as a prop to client components
- `window.location.href` on logout ensures React tree and QueryClient are destroyed as a second layer

---

### Fix 3 — Row-Level Security with restricted Postgres role (HIGH)

**Files:** `lib/db.ts`, `lib/admin-auth.ts`, `lib/audit-log.ts`, `lib/refresh-stats.ts`, all API routes under `app/api/trades/`, `app/api/rules/`, `app/api/settings/`, `app/api/dashboard/`, `app/api/analytics/`, all 10 admin routes, all 5 auth routes, `app/(auth)/choose-destination/page.tsx`, all server pages

**`lib/db.ts` — two connections, one helper:**

```ts
// Restricted role connection (respects RLS when DATABASE_URL_APP is set)
export const db = drizzle(neon(process.env.DATABASE_URL_APP ?? process.env.DATABASE_URL!), { schema });

// Owner connection (BYPASSRLS) — for admin routes and auth flows
export const adminDb = drizzle(neon(process.env.DATABASE_URL!), { schema });

// Wraps user-scoped queries in a transaction that sets the session variable
export async function withUserContext<T>(userId: string, fn: (tx) => Promise<T>): Promise<T>
```

**User-scoped API routes** (`trades`, `rules`, `settings`, `dashboard`, `analytics`):
- Changed `import { db }` → `import { withUserContext }`
- Wrapped all queries in `withUserContext(user.id, (tx) => ...)`
- `Promise.all([...])` batches run inside a single transaction so the `set_config` session variable applies to all parallel queries

**Admin and auth routes** (10 admin + 5 auth + choose-destination):
- Changed `import { db }` → `import { adminDb as db }`
- These query cross-user data (stats, user list, audit log) and run auth flows — they need BYPASSRLS

**`lib/refresh-stats.ts`:**
- Added recursive guard: if called without explicit db client (fire-and-forget from API routes), self-wraps in `withUserContext` before executing stats queries

**New scripts:**
- `scripts/migrate-rls.sql` — creates `tradecore_app` role, enables RLS on 9 tables, creates `user_isolation` policies using `current_setting('app.current_user_id', true)`
- `scripts/verify-rls.mjs` — connects as restricted role, inserts test fixtures for two users, asserts cross-user isolation, cleans up

**Environment variable to add:**
```
DATABASE_URL_APP=postgresql://tradecore_app:<password>@<host>/neondb?sslmode=require
```
Without this, `db` falls back to `DATABASE_URL` (owner role) and RLS is not enforced — the app is safe but the DB layer has no enforcement.

---

### Fix 4 — Realtime subscription scoped to authenticated user (LOW)

**File:** `components/dashboard/DashboardClient.tsx`

- Realtime channel renamed to `` `dashboard-rt:${userId}` `` to avoid collisions
- Added `filter: \`user_id=eq.${userId}\`` to the `postgres_changes` subscription so the server only delivers events for the current user's trades

---

## Deployment steps

1. **Deploy code** (this commit) — safe to deploy immediately; `withUserContext` falls back gracefully to owner connection when `DATABASE_URL_APP` is not set.

2. **Run RLS migration** against Neon:
   ```bash
   psql "$DATABASE_URL" -f scripts/migrate-rls.sql
   ```

3. **Create connection string for restricted role:**
   In Neon console → Roles → `tradecore_app` → copy connection string.  
   Set as `DATABASE_URL_APP` in Vercel environment variables.

4. **Verify isolation:**
   ```bash
   DATABASE_URL_APP="..." DATABASE_URL="..." node scripts/verify-rls.mjs
   ```
   All 5 checks must pass before treating RLS as enforced.

5. **Redeploy on Vercel** after adding `DATABASE_URL_APP` so the restricted role is used in production.

---

## Manual test for original incident scenario

1. Log in as User A, log a trade (EURUSD long).
2. Log out — hard nav to `/login`, QueryClient destroyed.
3. Open DevTools → Application → Cache Storage. Confirm no `/api/trades`, `/api/dashboard`, `/api/analytics` entries (they are no longer cached by the service worker).
4. Log in as User B (zero trades). Navigate to `/journal`.
5. **Expected:** empty list — no EURUSD trade visible.
6. Navigate to `/dashboard`. **Expected:** all KPIs are zero.
7. Log back in as User A. **Expected:** EURUSD trade reappears — own data loads correctly.
8. Run `node scripts/verify-rls.mjs` — all 5 DB-layer isolation checks pass.
