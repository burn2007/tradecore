"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoMark from "./LogoMark";

const TABS = [
  { slug: "",           label: "Overview"   },
  { slug: "users",      label: "Users"      },
  { slug: "audit-log",  label: "Audit log"  },
  { slug: "reserve",    label: "Reserve"    },
] as const;

interface AdminShellProps {
  admin: { email: string };
  children: React.ReactNode;
}

/**
 * Shell for every /admin-panel page. Tab links are built relative to
 * whatever path segment actually got the admin here (usePathname() reports
 * the original masked URL, not the internal /admin-panel rewrite target —
 * see proxy.ts) so this never needs to know the real ADMIN_PANEL_PATH value.
 */
export default function AdminShell({ admin, children }: AdminShellProps) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const base = `/${segments[0] ?? ""}`;
  const activeSlug = segments[1] ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", backgroundColor: "#111827" }}>
      {/* ── Topbar ── */}
      <header
        style={{
          height: "var(--topbar-height)",
          backgroundColor: "#0A0F1A",
          borderBottom: "1px solid #1A2640",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 14, flexShrink: 0 }}>
          <LogoMark />
          <span style={{ fontSize: 13, fontWeight: 500, color: "#D4C5A0", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
            TradeCore
          </span>
          <span style={{ fontSize: 10, fontWeight: 400, color: "#6B8AAA" }}>Admin</span>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingRight: 14, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: "#2E4060" }}>{admin.email}</span>
          <Link href="/dashboard" style={{ fontSize: 11, color: "#6B8AAA", textDecoration: "none" }}>
            Back to app
          </Link>
        </div>
      </header>

      {/* ── Tabs ── */}
      <nav style={{ display: "flex", gap: 2, padding: "8px 14px", borderBottom: "1px solid #1A2640", flexShrink: 0 }}>
        {TABS.map(({ slug, label }) => {
          const isActive = slug === activeSlug;
          const href = slug ? `${base}/${slug}` : base;
          return (
            <Link
              key={slug || "overview"}
              href={href}
              style={{
                fontSize: 11,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? "#C9B890" : "#2E4060",
                backgroundColor: isActive ? "#141E30" : "transparent",
                borderRadius: 6,
                padding: "5px 12px",
                textDecoration: "none",
                whiteSpace: "nowrap",
                transition: "color 0.15s, background-color 0.15s",
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6" style={{ backgroundColor: "#111827" }}>
        {children}
      </main>
    </div>
  );
}
