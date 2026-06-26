"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useNavLock } from "./NavLockContext";
import type { User } from "@/db/schema/users";

interface SidebarProps {
  user: User | null;
}

function getInitials(displayName?: string | null, email?: string | null): string {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "TC";
}

/* ── Custom SVG icons ── */

function DashboardIcon({ active }: { active: boolean }) {
  const fill = active ? "#E2B96F" : "none";
  const stroke = active ? "none" : "#2E4060";
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.2" fill={fill} stroke={stroke} strokeWidth="1.3" />
      <rect x="9" y="1" width="6" height="6" rx="1.2" fill={fill} stroke={stroke} strokeWidth="1.3" />
      <rect x="1" y="9" width="6" height="6" rx="1.2" fill={fill} stroke={stroke} strokeWidth="1.3" />
      <rect x="9" y="9" width="6" height="6" rx="1.2" fill={fill} stroke={stroke} strokeWidth="1.3" />
    </svg>
  );
}

function JournalIcon({ active }: { active: boolean }) {
  const stroke = active ? "#E2B96F" : "#2E4060";
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <line x1="2" y1="4" x2="14" y2="4" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="8" x2="14" y2="8" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="12" x2="11" y2="12" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AnalyticsIcon({ active }: { active: boolean }) {
  const stroke = active ? "#E2B96F" : "#2E4060";
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <polyline
        points="1.5,13 5,7.5 9,9.5 13.5,3"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MindEngineIcon({ active }: { active: boolean }) {
  const stroke = active ? "#E2B96F" : "#2E4060";
  const dotFill = active ? "#E2B96F" : "#2E4060";
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 2.5L14 12.5H2L8 2.5Z"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <line x1="8" y1="6" x2="8" y2="9.5" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="11" r="0.75" fill={dotFill} />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  const stroke = active ? "#E2B96F" : "#2E4060";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Nav items config ── */

type NavItem =
  | { href: string; label: string; Icon: React.FC<{ active: boolean }>; premium?: false }
  | { href: null; label: string; Icon: React.FC<{ active: boolean }>; premium: true };

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard",   Icon: DashboardIcon  },
  { href: "/journal",   label: "Journal",     Icon: JournalIcon    },
  { href: "/analytics", label: "Analytics",   Icon: AnalyticsIcon  },
  { href: null,         label: "Mind Engine", Icon: MindEngineIcon, premium: true },
  { href: "/settings",  label: "Settings",    Icon: SettingsIcon   },
];

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const { locked } = useNavLock();
  const [tooltip, setTooltip] = useState<string | null>(null);
  const initials = getInitials(user?.displayName, user?.email);

  return (
    <nav
      className="hidden md:flex md:flex-col md:items-center"
      style={{
        width: "var(--sidebar-width)",
        minWidth: "var(--sidebar-width)",
        backgroundColor: "var(--color-deep)",
        borderRight: "1px solid var(--color-border)",
        paddingBlock: 14,
        gap: 6,
        flexShrink: 0,
      }}
    >
      {NAV_ITEMS.map(({ href, label, Icon, premium }) => {
        const isActive = href
          ? pathname === href || pathname.startsWith(`${href}/`)
          : false;

        const iconContainer = (
          <div
            style={{
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 9,
              backgroundColor: isActive ? "#182840" : "transparent",
              transition: "background-color 0.15s",
              cursor: premium ? "default" : locked ? "not-allowed" : "pointer",
              opacity: href && locked ? 0.4 : 1,
            }}
          >
            <Icon active={isActive} />
          </div>
        );

        return (
          <div
            key={label}
            style={{ position: "relative" }}
            onMouseEnter={() => setTooltip(label)}
            onMouseLeave={() => setTooltip(null)}
          >
            {href ? (
              <Link
                href={href}
                tabIndex={locked ? -1 : undefined}
                aria-disabled={locked}
                onClick={(e) => { if (locked) e.preventDefault(); }}
                style={{ textDecoration: "none", display: "block", pointerEvents: locked ? "none" : "auto" }}
              >
                {iconContainer}
              </Link>
            ) : (
              <button
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "default",
                  display: "block",
                }}
              >
                {iconContainer}
              </button>
            )}

            {/* Tooltip */}
            {tooltip === label && (
              <div
                style={{
                  position: "absolute",
                  left: "calc(100% + 8px)",
                  top: "50%",
                  transform: "translateY(-50%)",
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  padding: "4px 9px",
                  fontSize: 11,
                  color: premium
                    ? "var(--color-gold)"
                    : "var(--color-text-secondary)",
                  whiteSpace: "nowrap",
                  zIndex: 50,
                  pointerEvents: "none",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                }}
              >
                {premium ? "Premium" : label}
              </div>
            )}
          </div>
        );
      })}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* User avatar */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          backgroundColor: "#1A2A40",
          border: "1px solid #2A3A50",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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
      </div>
    </nav>
  );
}
