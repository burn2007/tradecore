"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Avatar from "@/components/ui/Avatar";

interface AdminUserRow {
  id: string;
  email: string;
  displayName: string | null;
  tier: string;
  role: string;
  createdAt: string;
  tradeCount: number;
}

interface ApiResponse {
  users: AdminUserRow[];
  page: number;
  limit: number;
  totalCount: number;
}

const LIMIT = 25;

const INPUT: React.CSSProperties = {
  backgroundColor: "#0A0F1A",
  border: "1px solid #1A2640",
  borderRadius: 8,
  color: "#C9C2AE",
  height: 40,
  padding: "0 12px",
  width: "100%",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const TIER_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  free:    { bg: "#0A1220", color: "#4B6080", border: "#1A2640" },
  pro:     { bg: "#1A2A10", color: "#50E3B8", border: "#50E3B8" },
  premium: { bg: "#1A1A08", color: "#E2B96F", border: "#E2B96F" },
};

function fmtJoined(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function UsersClient() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const base = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [search, setSearch]           = useState(searchParams.get("search") ?? "");
  const [page, setPage]               = useState(1);

  const { data: stats } = useQuery<{ reserveCount: number }>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  // Debounce the input -> committed search term, 300ms, synced to the URL.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
      const params = new URLSearchParams(searchParams.toString());
      if (searchInput) params.set("search", searchInput);
      else params.delete("search");
      router.replace(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const { data, isLoading, isError } = useQuery<ApiResponse>({
    queryKey: ["admin-users", search, page],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      p.set("page", String(page));
      p.set("limit", String(LIMIT));
      const res = await fetch(`/api/admin/users?${p}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const users      = data?.users ?? [];
  const totalCount = data?.totalCount ?? 0;
  const showing    = (page - 1) * LIMIT + users.length;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 40 }}>
      {/* ── Header row ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <p style={{ fontSize: 16, fontWeight: 500, color: "#C9C2AE", margin: 0 }}>Users</p>
          {(stats?.reserveCount ?? 0) > 0 && (
            <Link
              href={`${base}/reserve`}
              style={{ fontSize: 11, color: "#6B8AAA", textDecoration: "none" }}
            >
              View reserve ({stats?.reserveCount})
            </Link>
          )}
        </div>
        <Link
          href={`${base}/users/new`}
          style={{
            height: 34, paddingInline: 14, borderRadius: 8,
            backgroundColor: "#E2B96F", border: "none",
            color: "#0A0F1A", fontSize: 12, fontWeight: 500,
            textDecoration: "none", display: "inline-flex",
            alignItems: "center", whiteSpace: "nowrap",
          }}
        >
          Create user
        </Link>
      </div>

      {/* ── Search ── */}
      <input
        type="text"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search by email or name…"
        style={{ ...INPUT, marginBottom: 16 }}
      />

      {/* ── Count ── */}
      {!isLoading && !isError && (
        <p style={{ fontSize: 11, color: "#4B6080", marginBottom: 10 }}>
          {totalCount === 0 ? "No users found" : `Showing ${showing} of ${totalCount} user${totalCount !== 1 ? "s" : ""}`}
        </p>
      )}

      {isLoading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#4B6080", fontSize: 13 }}>
          Loading users…
        </div>
      )}

      {isError && (
        <div style={{ backgroundColor: "#111C2E", border: "1px solid #1A2640", borderLeft: "3px solid #F07C7C", borderRadius: 8, padding: "10px 14px" }}>
          <p style={{ fontSize: 13, color: "#F07C7C", margin: 0 }}>Failed to load users. Please try again.</p>
        </div>
      )}

      {/* ── User list ── */}
      {!isLoading && users.map((u) => {
        const tierStyle = TIER_STYLE[u.tier] ?? TIER_STYLE.free;
        return (
          <div
            key={u.id}
            style={{
              backgroundColor: "#111C2E", border: "1px solid #1A2640",
              borderRadius: 8, padding: "10px 14px", marginBottom: 6,
              display: "flex", alignItems: "center", gap: 12,
            }}
          >
            <Avatar displayName={u.displayName} email={u.email} size={34} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 11.5, fontWeight: 500, color: "#C9C2AE", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {u.displayName || u.email}
              </p>
              <p style={{ fontSize: 9.5, color: "#2E4060", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {u.email}
              </p>
            </div>

            <span style={{
              fontSize: 10, fontWeight: 500, padding: "3px 8px", borderRadius: 5,
              backgroundColor: tierStyle.bg, color: tierStyle.color,
              border: `1px solid ${tierStyle.border}`,
              textTransform: "uppercase", letterSpacing: "0.05em",
              flexShrink: 0,
            }}>
              {u.tier}
            </span>

            <span style={{ fontSize: 11, color: "#6B8AAA", width: 70, textAlign: "right", flexShrink: 0 }}>
              {u.tradeCount} trade{u.tradeCount !== 1 ? "s" : ""}
            </span>

            <span style={{ fontSize: 10, color: "#2E4060", width: 50, textAlign: "right", flexShrink: 0 }}>
              {fmtJoined(u.createdAt)}
            </span>

            <Link href={`${base}/users/${u.id}`} style={{ fontSize: 11, color: "#6B8AAA", textDecoration: "none", flexShrink: 0 }}>
              View
            </Link>
          </div>
        );
      })}

      {/* ── Load more ── */}
      {!isLoading && !isError && showing < totalCount && (
        <button type="button" onClick={() => setPage((p) => p + 1)} style={{
          width: "100%", height: 40, marginTop: 8,
          backgroundColor: "#111C2E", border: "1px solid #1A2640",
          borderRadius: 8, color: "#6B8AAA", fontSize: 12,
          fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
        }}>
          Load more ({totalCount - showing} remaining)
        </button>
      )}
    </div>
  );
}
