"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/browser";
import { useNavLock } from "./NavLockContext";
import LogoMark from "./LogoMark";
import type { User } from "@/db/schema/users";

interface TopbarProps {
  user: User | null;
  adminPath?: string;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/journal",   label: "Journal"   },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings",  label: "Settings"  },
] as const;

function tbStartOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function tbToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const CURRENCIES = ["USD", "NGN", "GHS", "KES", "ZAR", "EUR", "GBP"] as const;

function getInitials(displayName?: string | null, email?: string | null): string {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "TC";
}

function LiveIndicator() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!online) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: "#E2B96F",
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 10, color: "#E2B96F" }}>Offline</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div
        className="tc-pulse"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: "var(--color-jade)",
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 10, color: "var(--color-jade)" }}>Manual mode</span>
    </div>
  );
}

export default function Topbar({ user, adminPath }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { locked } = useNavLock();
  const uid = user?.id ?? "";

  function prefetchNav(href: string) {
    if (!uid || locked) return;
    if (href === "/journal") {
      const from = tbStartOfMonth();
      const to = tbToday();
      void queryClient.prefetchQuery({
        queryKey: ["trades", uid, from, to, "", "", "", "", 0],
        queryFn: () => fetch(`/api/trades?from=${from}&to=${to}&limit=50&offset=0`).then((r) => r.json()),
        staleTime: 30_000,
      });
    } else if (href === "/analytics") {
      void queryClient.prefetchQuery({
        queryKey: ["analytics", uid],
        queryFn: () => fetch("/api/analytics").then((r) => r.json()),
        staleTime: 60_000,
      });
    }
  }
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const [userMenuHover, setUserMenuHover] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const currencyMenuRef = useRef<HTMLDivElement>(null);

  const initials = getInitials(user?.displayName, user?.email);
  const [currency, setCurrency] = useState(user?.preferredCurrency ?? "USD");

  useEffect(() => {
    setCurrency(user?.preferredCurrency ?? "USD");
  }, [user?.preferredCurrency]);

  async function handleSelectCurrency(next: string) {
    setShowCurrencyMenu(false);
    if (next === currency) return;
    const previous = currency;
    setCurrency(next);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredCurrency: next }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setCurrency(previous);
    }
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (currencyMenuRef.current && !currencyMenuRef.current.contains(e.target as Node)) {
        setShowCurrencyMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSignOut() {
    if (locked) return;
    setShowUserMenu(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    queryClient.clear();
    window.location.href = "/login";
  }

  return (
    <header
      style={{
        height: "var(--topbar-height)",
        backgroundColor: "var(--color-deep)",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        position: "relative",
        zIndex: 10,
      }}
    >
      {/* Left: logo + wordmark — left-padded to align logo with sidebar icon column */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingLeft: 14,
          paddingRight: 12,
          flexShrink: 0,
        }}
      >
        <LogoMark />
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#D4C5A0",
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
          }}
        >
          TradeCore
        </span>
      </div>

      {/* Mobile spacer — pushes avatar to the right when nav is hidden */}
      <div className="flex-1 md:hidden" />

      {/* Centre: nav links — desktop only */}
      <nav
        className="hidden md:flex"
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        {NAV_ITEMS.map(({ href, label }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              tabIndex={locked ? -1 : undefined}
              aria-disabled={locked}
              onClick={(e) => { if (locked) e.preventDefault(); }}
              onMouseEnter={() => prefetchNav(href)}
              style={{
                fontSize: 11,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? "#C9B890" : "var(--color-text-muted)",
                backgroundColor: isActive ? "#141E30" : "transparent",
                borderRadius: 6,
                padding: "5px 12px",
                textDecoration: "none",
                whiteSpace: "nowrap",
                transition: "color 0.15s, background-color 0.15s",
                pointerEvents: locked ? "none" : "auto",
                opacity: locked ? 0.4 : 1,
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Right: live indicator + currency badge + user avatar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          paddingRight: 14,
          flexShrink: 0,
        }}
      >
        {/* Live indicator — desktop only */}
        <span className="hidden md:flex items-center">
          <LiveIndicator />
        </span>

        {/* Currency badge — desktop only */}
        <div ref={currencyMenuRef} className="hidden md:block" style={{ position: "relative" }}>
          <button
            onClick={() => setShowCurrencyMenu((v) => !v)}
            style={{
              backgroundColor: "#0A1220",
              border: "1px solid var(--color-border)",
              borderRadius: 5,
              padding: "3px 8px",
              fontSize: 10,
              color: "var(--color-text-muted)",
              cursor: "pointer",
              fontFamily: "inherit",
              letterSpacing: "0.04em",
            }}
          >
            {currency}
          </button>
          {showCurrencyMenu && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: 6,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                minWidth: 80,
                zIndex: 50,
                boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
              }}
            >
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  onClick={() => handleSelectCurrency(c)}
                  style={{
                    backgroundColor:
                      c === currency ? "rgba(226,185,111,0.08)" : "transparent",
                    color:
                      c === currency
                        ? "var(--color-gold)"
                        : "var(--color-text-secondary)",
                    border: "none",
                    borderRadius: 5,
                    padding: "5px 10px",
                    fontSize: 11,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Admin switcher — only rendered for admin users */}
        {user?.role === "admin" && adminPath && (
          <a
            href={adminPath}
            style={{
              fontSize: 10,
              color: "#6B8AAA",
              textDecoration: "none",
              whiteSpace: "nowrap",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#C9C2AE"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#6B8AAA"; }}
          >
            Switch to Admin
          </a>
        )}

        {/* User avatar + dropdown */}
        <div ref={userMenuRef} style={{ position: "relative" }}>
          <button
            onClick={() => setShowUserMenu((v) => !v)}
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              backgroundColor: "#1A2A40",
              border: "1px solid #2A3A50",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: 0,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: "var(--color-gold)",
                letterSpacing: "0.02em",
                lineHeight: 1,
              }}
            >
              {initials}
            </span>
          </button>

          {showUserMenu && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: 6,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                minWidth: 160,
                zIndex: 50,
                boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
              }}
            >
              {(user?.displayName || user?.email) && (
                <div
                  style={{
                    padding: "6px 10px 8px",
                    borderBottom: "1px solid var(--color-border)",
                    marginBottom: 2,
                  }}
                >
                  {user.displayName && (
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {user.displayName}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--color-text-muted)",
                      marginTop: 1,
                    }}
                  >
                    {user.email}
                  </div>
                </div>
              )}

              <Link
                href="/settings"
                tabIndex={locked ? -1 : undefined}
                aria-disabled={locked}
                onClick={(e) => { if (locked) { e.preventDefault(); return; } setShowUserMenu(false); }}
                onMouseEnter={() => setUserMenuHover("profile")}
                onMouseLeave={() => setUserMenuHover(null)}
                style={{
                  display: "block",
                  padding: "6px 10px",
                  fontSize: 12,
                  color: "var(--color-text-secondary)",
                  textDecoration: "none",
                  borderRadius: 5,
                  backgroundColor:
                    userMenuHover === "profile"
                      ? "rgba(255,255,255,0.03)"
                      : "transparent",
                  pointerEvents: locked ? "none" : "auto",
                  opacity: locked ? 0.4 : 1,
                }}
              >
                Profile
              </Link>

              <button
                onClick={handleSignOut}
                disabled={locked}
                onMouseEnter={() => setUserMenuHover("signout")}
                onMouseLeave={() => setUserMenuHover(null)}
                style={{
                  backgroundColor:
                    userMenuHover === "signout"
                      ? "rgba(240,124,124,0.08)"
                      : "transparent",
                  border: "none",
                  padding: "6px 10px",
                  fontSize: 12,
                  color: "var(--color-rose)",
                  cursor: locked ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  borderRadius: 5,
                  width: "100%",
                  opacity: locked ? 0.4 : 1,
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
