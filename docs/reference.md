# TradeCore Reference

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

