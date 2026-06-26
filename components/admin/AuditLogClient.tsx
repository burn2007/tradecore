"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface AuditEntry {
  id: string;
  adminUserId: string;
  adminEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface ApiResponse {
  entries: AuditEntry[];
  page: number;
  limit: number;
  totalCount: number;
}

const LIMIT = 50;

function fmtTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function target(entry: AuditEntry) {
  if (!entry.targetType && !entry.targetId) return "—";
  const shortId = entry.targetId ? entry.targetId.slice(0, 8) : "";
  return [entry.targetType, shortId].filter(Boolean).join(" · ");
}

export default function AuditLogClient() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery<ApiResponse>({
    queryKey: ["admin-audit-log", page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/audit-log?page=${page}&limit=${LIMIT}`);
      if (!res.ok) throw new Error("Failed to fetch audit log");
      return res.json();
    },
  });

  const entries     = data?.entries ?? [];
  const totalCount  = data?.totalCount ?? 0;
  const showing     = (page - 1) * LIMIT + entries.length;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", paddingBottom: 40 }}>
      <p style={{ fontSize: 16, fontWeight: 500, color: "#C9C2AE", margin: "0 0 16px" }}>Audit log</p>

      {!isLoading && !isError && (
        <p style={{ fontSize: 11, color: "#4B6080", marginBottom: 10 }}>
          {totalCount === 0 ? "No entries yet" : `Showing ${showing} of ${totalCount} entr${totalCount !== 1 ? "ies" : "y"}`}
        </p>
      )}

      {isLoading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#4B6080", fontSize: 13 }}>
          Loading…
        </div>
      )}

      {isError && (
        <div style={{ backgroundColor: "#111C2E", border: "1px solid #1A2640", borderLeft: "3px solid #F07C7C", borderRadius: 8, padding: "10px 14px" }}>
          <p style={{ fontSize: 13, color: "#F07C7C", margin: 0 }}>Failed to load audit log. Please try again.</p>
        </div>
      )}

      {!isLoading && entries.map((entry) => (
        <div
          key={entry.id}
          style={{
            backgroundColor: "#111C2E", border: "1px solid #1A2640",
            borderRadius: 8, padding: "10px 14px", marginBottom: 6,
            display: "flex", alignItems: "center", gap: 14,
          }}
        >
          <span style={{ fontSize: 10, color: "#2E4060", width: 110, flexShrink: 0 }}>
            {fmtTimestamp(entry.createdAt)}
          </span>
          <span style={{ fontSize: 11, color: "#6B8AAA", width: 180, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {entry.adminEmail ?? "unknown"}
          </span>
          <span style={{ fontSize: 11, color: "#C9C2AE", flex: 1, minWidth: 0 }}>
            {entry.action}
          </span>
          <span style={{ fontSize: 10, color: "#4B6080", width: 110, flexShrink: 0, textAlign: "right" }}>
            {target(entry)}
          </span>
          <span style={{ fontSize: 10, color: "#2E4060", width: 90, flexShrink: 0, textAlign: "right" }}>
            {entry.ipAddress ?? "—"}
          </span>
        </div>
      ))}

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
