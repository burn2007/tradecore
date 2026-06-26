"use client";

import { useQuery } from "@tanstack/react-query";

interface StatsResponse {
  totalUsers: number;
  usersByTier: { free: number; pro: number; premium: number };
  totalTrades: number;
  newSignups7d: number;
  unauthorizedAttempts7d: number;
}

interface AuditEntry {
  id: string;
  adminEmail: string | null;
  action: string;
  createdAt: string;
}

interface AuditLogResponse {
  entries: AuditEntry[];
}

function fmtTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function KpiCard({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div style={{
      backgroundColor: "#111C2E", border: "1px solid #1A2640",
      borderRadius: 11, padding: "12px 14px",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: accent }} />
      <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "#2E4060", margin: "0 0 6px" }}>
        {label}
      </p>
      <p style={{ fontSize: 21, fontWeight: 500, color: accent, margin: 0 }}>{value}</p>
    </div>
  );
}

export default function OverviewClient() {
  const { data: stats, isLoading: statsLoading } = useQuery<StatsResponse>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { data: auditLog, isLoading: auditLoading } = useQuery<AuditLogResponse>({
    queryKey: ["admin-audit-log", "recent"],
    queryFn: async () => {
      const res = await fetch("/api/admin/audit-log?page=1&limit=8");
      if (!res.ok) throw new Error("Failed to fetch audit log");
      return res.json();
    },
  });

  const proPlusPremium = (stats?.usersByTier.pro ?? 0) + (stats?.usersByTier.premium ?? 0);
  const unauthorized7d = stats?.unauthorizedAttempts7d ?? 0;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 40 }}>
      <p style={{ fontSize: 16, fontWeight: 500, color: "#C9C2AE", margin: "0 0 20px" }}>Overview</p>

      {/* ── KPI row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
        <KpiCard label="Total users" value={statsLoading ? "—" : stats?.totalUsers ?? 0} accent="#50E3B8" />
        <KpiCard label="Pro + Premium" value={statsLoading ? "—" : proPlusPremium} accent="#E2B96F" />
        <KpiCard label="Trades logged" value={statsLoading ? "—" : stats?.totalTrades ?? 0} accent="#8BA8C4" />
        <KpiCard
          label="Unauthorized attempts (7d)"
          value={statsLoading ? "—" : unauthorized7d}
          accent={unauthorized7d > 0 ? "#F07C7C" : "#2E4060"}
        />
      </div>

      {/* ── Recent activity ── */}
      <div style={{ backgroundColor: "#111C2E", border: "1px solid #1A2640", borderRadius: 11, padding: "14px 16px" }}>
        <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "#2E4060", margin: "0 0 12px" }}>
          Recent activity
        </p>

        {auditLoading ? (
          <p style={{ fontSize: 12, color: "#4B6080", margin: 0 }}>Loading…</p>
        ) : (auditLog?.entries ?? []).length === 0 ? (
          <p style={{ fontSize: 12, color: "#4B6080", margin: 0 }}>No activity yet.</p>
        ) : (
          (auditLog?.entries ?? []).map((entry, i) => (
            <div
              key={entry.id}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 0",
                borderTop: i === 0 ? "none" : "1px solid #0F1A2A",
              }}
            >
              <span style={{ fontSize: 11, color: "#6B8AAA" }}>
                {entry.action} — {entry.adminEmail ?? "unknown"}
              </span>
              <span style={{ fontSize: 10, color: "#2E4060" }}>{fmtTimestamp(entry.createdAt)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
