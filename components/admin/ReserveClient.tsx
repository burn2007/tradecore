"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Avatar from "@/components/ui/Avatar";
import { pushToast } from "@/components/ui/Toast";

interface AdminReserveRow {
  id: string;
  email: string;
  displayName: string | null;
  tier: string;
  role: string;
  deletedAt: string;
  deletedByEmail: string | null;
}

interface ApiResponse {
  users: AdminReserveRow[];
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

function fmtDeleted(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ReserveClient() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const base = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [search, setSearch]           = useState(searchParams.get("search") ?? "");
  const [page, setPage]               = useState(1);

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
    queryKey: ["admin-reserve", search, page],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      p.set("page", String(page));
      p.set("limit", String(LIMIT));
      const res = await fetch(`/api/admin/users/reserve?${p}`);
      if (!res.ok) throw new Error("Failed to fetch reserve");
      return res.json();
    },
  });

  const restoreMutation = useMutation<unknown, Error, string>({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users/${id}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to restore");
      return res.json();
    },
    onSuccess: () => {
      pushToast({ label: "Account restored.", accent: "#50E3B8" });
      queryClient.invalidateQueries({ queryKey: ["admin-reserve"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: () => {
      pushToast({ label: "Failed to restore account.", accent: "#F07C7C" });
    },
  });

  const users      = data?.users ?? [];
  const totalCount = data?.totalCount ?? 0;
  const showing    = (page - 1) * LIMIT + users.length;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 40 }}>
      <p style={{ fontSize: 16, fontWeight: 500, color: "#C9C2AE", margin: "0 0 16px" }}>Reserve</p>

      {/* ── Search ── */}
      <input
        type="text"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search by email or name…"
        style={{ ...INPUT, marginBottom: 16 }}
      />

      {/* ── Count ── */}
      {!isLoading && !isError && totalCount > 0 && (
        <p style={{ fontSize: 11, color: "#4B6080", marginBottom: 10 }}>
          Showing {showing} of {totalCount} deleted account{totalCount !== 1 ? "s" : ""}
        </p>
      )}

      {isLoading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#4B6080", fontSize: 13 }}>
          Loading reserve…
        </div>
      )}

      {isError && (
        <div style={{ backgroundColor: "#111C2E", border: "1px solid #1A2640", borderLeft: "3px solid #F07C7C", borderRadius: 8, padding: "10px 14px" }}>
          <p style={{ fontSize: 13, color: "#F07C7C", margin: 0 }}>Failed to load reserve. Please try again.</p>
        </div>
      )}

      {!isLoading && !isError && totalCount === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p style={{ fontSize: 13, color: "#4B6080", margin: 0 }}>No deleted accounts.</p>
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
              <p style={{ fontSize: 9.5, color: "#4B6080", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Deleted {fmtDeleted(u.deletedAt)} by {u.deletedByEmail || "unknown"}
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

            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, paddingLeft: 10 }}>
              <button
                type="button"
                disabled={restoreMutation.isPending}
                onClick={() => restoreMutation.mutate(u.id)}
                style={{
                  height: 28, paddingInline: 12, borderRadius: 6,
                  backgroundColor: "transparent", border: "1px solid #50E3B8",
                  color: "#50E3B8", fontSize: 11, fontFamily: "inherit",
                  cursor: restoreMutation.isPending ? "default" : "pointer",
                  opacity: restoreMutation.isPending ? 0.6 : 1,
                  transition: "opacity 0.15s ease",
                }}
              >
                Restore
              </button>
              <Link href={`${base}/users/${u.id}`} style={{ fontSize: 11, color: "#6B8AAA", textDecoration: "none" }}>
                View
              </Link>
            </div>
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
