"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNavLock } from "./NavLockContext";

/* ── Custom SVG icons at 20px ── */

function DashboardIcon({ active }: { active: boolean }) {
  const fill = active ? "#E2B96F" : "none";
  const stroke = active ? "none" : "#2E4060";
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
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
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
      <line x1="2" y1="4" x2="14" y2="4" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="8" x2="14" y2="8" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="12" x2="11" y2="12" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AnalyticsIcon({ active }: { active: boolean }) {
  const stroke = active ? "#E2B96F" : "#2E4060";
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
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

function SettingsIcon({ active }: { active: boolean }) {
  const stroke = active ? "#E2B96F" : "#2E4060";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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

const TABS = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/journal",   label: "Journal",   Icon: JournalIcon   },
  { href: "/analytics", label: "Analytics", Icon: AnalyticsIcon },
  { href: "/settings",  label: "Settings",  Icon: SettingsIcon  },
] as const;

export default function BottomTabBar() {
  const pathname = usePathname();
  const { locked } = useNavLock();

  return (
    /* Outer div handles safe-area extension below the 60px bar */
    <div
      className="flex md:hidden"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#0A0F1A",
        borderTop: "1px solid #1A2640",
        paddingBottom: "env(safe-area-inset-bottom)",
        zIndex: 50,
      }}
    >
      {/* Inner row is exactly 60px — safe-area padding sits below it */}
      <div style={{ height: 60, display: "flex", width: "100%" }}>
        {TABS.map(({ href, label, Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              tabIndex={locked ? -1 : undefined}
              aria-disabled={locked}
              onClick={(e) => { if (locked) e.preventDefault(); }}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                textDecoration: "none",
                color: isActive ? "#E2B96F" : "#2E4060",
                minHeight: 44,
                pointerEvents: locked ? "none" : "auto",
                opacity: locked ? 0.4 : 1,
              }}
            >
              <Icon active={isActive} />
              <span
                style={{
                  fontSize: 9,
                  fontFamily: "inherit",
                  fontWeight: isActive ? 500 : 400,
                  lineHeight: 1,
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
