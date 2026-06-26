# TradeCore Security Audit — 2026-06-24

Pre-admin-panel audit. Findings only — nothing in this report has been remediated yet.

Method: static review of every route under `app/api` and `app/(app)`, `proxy.ts`, `lib/supabase/*`; live queries against the production Neon DB (`pg_roles`, `pg_class`, `pg_policies`, `pg_proc`); `git log --all -S` over full local history; dependency check of `@supabase/ssr` cookie defaults.

---

## CRITICAL

### C1. Live DB password + Supabase `service_role` key committed to git, tracked in `.env.example`
- `.env.example` (tracked, not gitignored) contains a real `DATABASE_URL` / `DATABASE_URL_DIRECT` with a live Neon password, and a real `SUPABASE_SERVICE_ROLE_KEY` JWT.
- Confirmed these are the **currently active** credentials — they match `.env` and `.env.local` byte-for-byte on the password fragment.
- Present in git history since commit `219c5eb` ("Prompt 4 complete — authentication working") and still at HEAD (`git status` shows no diff on the file).
- `service_role` key bypasses Supabase Auth and any RLS entirely — full read/write on `auth.users` and any Supabase-side table, plus the ability to mint admin sessions. The DB password gives direct Postgres access, bypassing the app and any future RLS entirely.
- Mitigating factor: `git remote -v` is empty — this is a local-only repo, never pushed. Exposure today is limited to the local filesystem/git history. **The instant this repo is pushed to any remote (GitHub, etc.), both secrets become permanently exposed in that remote's history**, even if removed in a later commit.
- Action required before any push: rotate the Neon password and the Supabase service_role key, replace `.env.example` with placeholders, and either scrub history (`git filter-repo`/BFG) or re-init history before the first push.

### C2. Row Level Security provides zero protection — confirmed disabled, not just bypassed
Live query results against the production Neon DB:
- `pg_class.relrowsecurity = false` on **all 11 tables** (`users`, `trades`, `trade_screenshots`, `emotion_logs`, `rules`, `rule_violations`, `setup_tags`, `stats_cache`, `user_milestones`, `weekly_summaries`, `ai_context_cache`). RLS is currently **off**, not merely force-bypassed — this contradicts the CLAUDE.md Prompt-2 log ("RLS ENABLED + FORCED ✅"), which was true at the time but is no longer the live state. `relforcerowsecurity = true` is still set on every table, but FORCE has no effect while RLS itself is disabled.
- `pg_policies` returns **zero rows** — no `USING`/`WITH CHECK` policy exists anywhere. `db/rls.sql` defines policies keyed on `auth.uid()`, but that function does not exist in this database (`pg_proc` lookup for `uid` returns nothing — `auth.uid()` is a Supabase-Postgres-only function, and this is Neon). `scripts/apply-rls.mjs`, the script that actually ran against the live DB, only issues `ENABLE`/`FORCE ROW LEVEL SECURITY` — it never creates policies, and says so in its own comments. `db/rls.sql` was written for reference but, per the architecture note already in `apply-rls.mjs`, was never something that *could* run successfully here.
- `neondb_owner` (the only role the app ever connects as, confirmed via `current_user`/`session_user`) has `rolbypassrls = true`. Even if real policies existed, this role would still see/write every row.
- **Net effect**: 100% of multi-tenant data isolation currently depends on the application-layer `WHERE user_id = ...` predicate being present and correct in every single query, with zero database-level backstop. I confirmed (Item 7 below) that this predicate is present and correct everywhere it's needed today — but there is nothing to catch a future mistake, e.g. in the admin panel you're about to build.

---

## HIGH

### H1. `/api/internal/refresh-stats` currently has authentication fully disabled
- `INTERNAL_API_SECRET` is still the literal placeholder string (`replace-with-random-32-char-hex-string`) in both `.env` and `.env.local`.
- Per the route's own logic (`app/api/internal/refresh-stats/route.ts:16-29`), an unset/placeholder secret routes into the "auth disabled" branch — the `x-internal-secret` header check is skipped entirely.
- Current live impact: any unauthenticated caller can `POST /api/internal/refresh-stats` with an arbitrary `{ userId }` and (a) force a full stats recomputation for that user (DB load / minor DoS vector — every call runs ~6 queries), and (b) receive that user's full `StatsResult` (win rate, total P&L, phantom P&L, behavioral gap, streaks, best setup, etc.) back in the response — a real data leak if a user's UUID is ever guessable or logged anywhere client-visible (e.g. in a URL).

### H2. No rate limiting anywhere
- No middleware-level or per-route throttling exists on any endpoint. `@upstash/redis` is an installed dependency but is never imported/used anywhere in the codebase.
- Highest-exposure targets: `/api/auth/*` (login/register rely solely on whatever Supabase's hosted platform applies — no app-level backstop), and `/api/trades/import` (accepts up to 10,000 rows per request via `importBodySchema`, with no limit on how often an authenticated user can call it — repeated large imports could be used to hammer the DB).

---

## MEDIUM

### M1. Supabase session tokens are stored in non-httpOnly cookies
- Confirmed via `@supabase/ssr`'s shipped default (`node_modules/@supabase/ssr/dist/main/utils/constants.js`): `DEFAULT_COOKIE_OPTIONS = { path: "/", sameSite: "lax", httpOnly: false, maxAge: ... }`.
- Neither `proxy.ts` nor `lib/supabase/server.ts` overrides this when calling `cookieStore.set(...)` / `supabaseResponse.cookies.set(...)` — both pass `options` straight through.
- So: tokens are **not** in `localStorage` (that part of the original assumption holds), but they **are** readable via `document.cookie` from any JS running on the page — functionally the same exposure as `localStorage` if an XSS vector ever exists.
- No `dangerouslySetInnerHTML` or raw `innerHTML` usage was found anywhere in the codebase (`grep` across all `.ts`/`.tsx` returned zero matches), so there is no known XSS vector today. This should be tracked as a standing design tradeoff (it's the documented `@supabase/ssr` pattern, not a bug), not assumed equivalent to httpOnly-cookie protection.

---

## LOW

### L1. `app/api/auth/onboarding/route.ts` doesn't guard `request.json()` with try/catch
Every other mutation route (`trades`, `trades/[id]`, `rules`, `rules/[id]`, `settings`, `trades/import`, `trades/[id]/review`) wraps body parsing in a try/catch that returns a clean 400 on malformed JSON. `auth/onboarding` does not — malformed JSON throws an unhandled exception (500) instead. Inconsistency, not a vulnerability.

### L2. CSV import numeric fields are validated as raw strings
`parsedTradeSchema` in `app/api/trades/import/route.ts` types `entry_price`, `pnl_usd`, etc. as `z.string()` with no numeric-format check. Malformed values are only caught later by the Postgres insert (caught in a try/catch, counted toward `failed`), not rejected at the Zod layer. Data-integrity gap, not a security issue — flagged for completeness.

---

## Confirmed clean (explicitly verified, no action needed)

- **Next.js version**: `next@16.2.9` installed — well past the CVE-2025-29927 vulnerable range (<12.3.5, <13.5.9, <14.2.25, <15.2.3).
- **Auth boundary, Item 1**: every route under `app/api` (13 of 14 files) independently calls `supabase.auth.getUser()` and returns 401 on no user, rather than trusting `proxy.ts` alone. Verified file-by-file: `auth/callback`, `auth/sync-user`, `auth/onboarding`, `settings`, `rules`, `rules/[id]`, `trades`, `trades/[id]`, `trades/[id]/review`, `trades/import`, `analytics`, `uploads/screenshot`, `dashboard`. The one exception, `internal/refresh-stats`, uses a shared-secret model by design — see H1 for its current (broken) state. The `(app)` server layout (`app/(app)/layout.tsx`) also independently calls `getUser()` and redirects, on top of `proxy.ts`.
- **Input validation, Item 4**: every POST/PATCH that accepts a body validates with Zod before touching the DB (`tradeSchema`, `patchSchema` ×2, `reviewSchema`, `ruleSchema`, `settingsSchema`, `importBodySchema`, onboarding's inline schema). DELETE routes take no body. No unvalidated mutation endpoint found.
- **CORS, Item 6**: zero `Access-Control-*` headers anywhere in the codebase (`next.config.ts`, every route handler, `proxy.ts`). Default Next.js same-origin behavior applies — no permissive CORS configuration exists that would let a third-party site call the API with a stolen cookie.
- **Ownership on mutations, Item 7**: every PATCH/DELETE checked uses `and(eq(table.id, id), eq(table.userId, user.id))`, not `id` alone — confirmed on `trades/[id]` (PATCH, DELETE), `rules/[id]` (PATCH, DELETE), and `trades/[id]/review` (PATCH, via an explicit ownership `SELECT` before any write). `settings` PATCH mutates the caller's own row directly (`eq(users.id, user.id)`) with no foreign resource ID involved, so there's no guessable-ID surface there.
- **Secrets in source code**: zero hardcoded secrets found in any `.ts`/`.tsx`/`.mjs`/`.js` file under `app`, `components`, `lib`, `db`, `scripts` — the only leak is the tracked `.env.example` (see C1).
