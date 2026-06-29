# TradeCore — Claude Code Project Log

## Project Description
A trading journal SaaS for African forex traders (Nigeria, Ghana, Kenya, South Africa). Primary goals: works on cheap Android phones, offline-capable PWA, P&L in local currencies (NGN/GHS/KES/ZAR), shareable stats cards for Telegram.

## Tech Stack
Next.js 15 App Router, TypeScript (strict), Tailwind CSS v3 (Dusk CSS variables), Supabase (Auth), Neon serverless Postgres, Drizzle ORM, Zod, TanStack Query v5, Recharts, @ducanh2912/next-pwa (Workbox 6), Cloudflare R2 (Screenshots), Upstash Redis (Jobs), Resend (Email).

## Status
Free tier complete (Prompts 1-13, 15-17). Prompt 14 deferred. Admin panel, soft-delete/reserve, and destination chooser added beyond original plan, also complete. Auth flows complete (Prompt 22): forgot password, reset password, email verification + resend, proxy email_confirmed_at gate.

## Currently active known issues
- **NEXT_PUBLIC_R2_PUBLIC_URL** not in `.env` — screenshot uploads succeed (R2 PUT works) but the returned URL is the raw R2 key string unless this variable is set to the R2 public bucket URL. `POST /api/uploads/screenshot` now returns 503 instead of silently uploading when this is still the placeholder.
- **.env.example has a live Neon DB connection string (incl. password) checked into git history.** Not fixed this session — needs a decision on credential rotation and whether to scrub git history before treating this as resolved.

## Deployment
Hosted on Vercel via GitHub, env vars added manually in Vercel dashboard, production build runs full strict TypeScript checking unlike local dev.

## Architecture note — `withUserContext` is a passthrough
`lib/db.ts`'s `withUserContext` currently just calls `fn(db)` — no transaction, no RLS session variables (neon-http doesn't support stateful sessions). Data isolation relies on explicit `WHERE user_id = ...` clauses. Do NOT write code that relies on `withUserContext` passing a different `db` reference from the module-level `db` singleton — it doesn't.

## Recent Changes

### 2026-06-29 — Hotfix: stats_cache never written (infinite recursion in refresh-stats)
Files changed: `lib/refresh-stats.ts`, `app/api/trades/route.ts`, `app/api/trades/[id]/route.ts`, `app/api/trades/[id]/review/route.ts`, `app/api/trades/import/route.ts`
- Removed dead recursion guard from `refreshStatsForUser` — the `if (dbClient === defaultDb)` block called `withUserContext`, which (after the neon-http revert) returns the same `db` reference, making the guard permanently true and causing infinite synchronous recursion silently caught by `.catch(() => {})`
- `refreshStatsForUser` now calls `computeUserStats` directly with no self-call
- All five `.catch(() => {})` fire-and-forget call sites updated to `.catch((err) => console.error("[refresh-stats] failed:", err))` so failures surface in server logs
- Backfilled `stats_cache` for all three affected real users; `tsc --noEmit` → zero errors
- Branch: `fix/stats-cache-recursion`

### 2026-06-29 — Navigation prefetch + instant transitions
Files changed: `components/layout/sidebar.tsx`, `components/layout/topbar.tsx`, `components/layout/BottomTabBar.tsx`, `components/layout/shell.tsx`, `components/trades/JournalClient.tsx`, `components/dashboard/DashboardClient.tsx`
- Added `queryClient.prefetchQuery` on `mouseenter` (desktop) and `touchstart` (mobile) for Journal and Analytics in Sidebar, Topbar, and BottomTabBar — uses exact same query keys/fns as destination components so cache entries are shared
- Dashboard fires a one-shot background prefetch for the default Journal query once its own data first resolves (`didPrefetchJournal` ref prevents repeat calls)
- `BottomTabBar` now receives `userId` prop (from Shell via `user?.id`); all three nav components guard against locked nav and empty userId before prefetching
- Added `placeholderData: keepPreviousData` to JournalClient query — filter/pagination changes now show stale results while the next fetch loads instead of clearing to skeleton
- Converted `KpiCard` and `ComplianceCard` in DashboardClient from `router.push()` onClick to `<Link>` wrappers; ripple effect preserved via `onClick` on the Link; removed unused `useRouter` import
- All nav links in Sidebar, Topbar, BottomTabBar already used `<Link>` (confirmed); admin switcher stays as plain `<a>` (external path)
- `lib/db.ts` and all database/driver/transaction code untouched

### 2026-06-29 — UI performance pass (TradeDetail only)
File changed: `components/trades/TradeDetail.tsx`
- Replaced bare "Loading trade…" text with shimmer skeleton cards (header, screenshot, emotion, action buttons) matching Dusk card dimensions (`#111C2E`, `borderRadius: 11`, same `tc-shimmer` animation as Dashboard)
- Added `staleTime: 60_000` to the trade detail query (matches Dashboard/Analytics)
- Converted screenshot `<img>` tags to `next/image` with `loading="lazy"`, `sizes="(max-width: 520px) 100vw, 520px"`, and responsive CSS — `next.config.ts` `remotePatterns` for `**.r2.cloudflarestorage.com` was already in place
- `lib/db.ts` and all database/driver/transaction code untouched

## Reference Files
- Full design tokens, env var list, and folder structure: see docs/reference.md — read that file directly when you need these details, do not assume they're in this file.
- For full historical decisions and fixed-issue history, see docs/changelog.md
