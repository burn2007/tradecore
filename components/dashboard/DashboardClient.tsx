"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  ReferenceLine,
  Tooltip,
} from "recharts";
import { createClient } from "@/lib/supabase/browser";
import { useCurrency } from "@/hooks/useCurrency";
import { ToastStack, pushToast } from "@/components/ui/Toast";

/* ─────────────────────────────────── Types ── */

interface StatsCache {
  winRate:           string | null;
  totalPnl:          string | null;
  totalTrades:       number;
  closedTrades:      number;
  ruleCompliancePct: string | null;
  bestSession:       string | null;
  currentStreak:     number;
  disciplineScore:   string | null;
}

interface EquityPoint { date: string; real: number; phantom: number; }

interface SessionEdge {
  session: string;
  total:   number;
  wins:    number;
  winRate: number;
}

interface RecentTrade {
  id:             string;
  symbol:         string;
  direction:      string;
  pnlUsd:         string | null;
  setupTag:       string | null;
  session:        string | null;
  source:         string;
  entryAt:        string;
  exitAt:         string | null;
  violationCount: number;
}

interface MilestoneNotification {
  milestoneKey: string;
  achievedAt:   string;
}

interface DashboardData {
  stats:          StatsCache | null;
  equityCurve:    EquityPoint[];
  phantomPnl:     number;
  behavioralGap:  number;
  monthlyPnl:     number;
  sessionEdge:    SessionEdge[];
  recentTrades:   RecentTrade[];
  totalTrades:    number;
  newly_achieved: MilestoneNotification[];
}

/* ─────────────────────────────── Helpers ── */

function greeting(utcHour: number) {
  if (utcHour >= 5  && utcHour < 12) return "Good morning";
  if (utcHour >= 12 && utcHour < 17) return "Good afternoon";
  return "Good evening";
}

function weekNumber(d: Date) {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - jan1.getTime()) / 86_400_000) + jan1.getDay() + 1) / 7);
}

function londonStatus(): string {
  const now = new Date();
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const open = 7 * 60, close = 16 * 60;
  if (mins >= open && mins < close) return "London session active";
  const until = mins < open ? open - mins : 24 * 60 - mins + open;
  if (until <= 120) {
    const h = Math.floor(until / 60), m = until % 60;
    return `London opens in ${h > 0 ? `${h}h ` : ""}${m}m`;
  }
  return "";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function sessionLabel(key: string | null | undefined): string {
  if (!key) return "";
  if (key === "newyork"  || key === "new_york" || key === "overlap_london_ny") return "New York";
  if (key === "african")  return "African";
  if (key === "london")   return "London";
  if (key === "asian" || key === "tokyo" || key === "sydney") return "Asian";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/* ──────────────────── Milestone toast copy ── */

const MILESTONE_LABELS: Record<string, { label: string; icon: string }> = {
  first_trade:          { icon: "🎯", label: "First trade logged!" },
  "10_trades":          { icon: "📈", label: "10 trades logged" },
  "50_trades":          { icon: "🔥", label: "50 trades logged" },
  "100_trades":         { icon: "💎", label: "100 trades logged" },
  first_profit:         { icon: "✅", label: "First profitable session!" },
  first_compliant_week: { icon: "🏆", label: "Perfect compliance week!" },
  "7_day_streak":       { icon: "⚡", label: "7-day compliance streak!" },
};

/* ──────────────────────────── Sub-components ── */

function Skeleton({ w = "100%", h = 16, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg, #111C2E 25%, #1A2640 50%, #111C2E 75%)",
      backgroundSize: "200% 100%",
      animation: "tc-shimmer 1.6s ease-in-out infinite",
    }} />
  );
}

function Card({ children, style, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      backgroundColor: "#111C2E", border: "1px solid #1A2640",
      borderRadius: 11, padding: "14px 16px",
      ...style,
    }}>
      {children}
    </div>
  );
}

function AccentBar({ color, taller = false }: { color: string; taller?: boolean }) {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0,
      height: taller ? 3 : 2,
      backgroundColor: color,
      transition: "height 180ms ease",
    }} />
  );
}

function spawnRipple(e: React.MouseEvent<HTMLDivElement>, accent: string) {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const el = document.createElement("div");
  el.style.cssText = [
    "position:absolute",
    `left:${x}px`,
    `top:${y}px`,
    "width:8px",
    "height:8px",
    "border-radius:50%",
    `background:${accent}`,
    "opacity:0.25",
    "pointer-events:none",
    "transform:translate(-50%,-50%) scale(0)",
    "animation:tc-ripple 500ms ease-out forwards",
  ].join(";");
  e.currentTarget.appendChild(el);
  setTimeout(() => el.remove(), 520);
}

/* KPI card — Net P&L, Phantom P&L, Win Rate */
function KpiCard({
  label, value, sub, accent, valueColor, loading, bottom, href,
}: {
  label: string; value: string; sub: string;
  accent: string; valueColor?: string; loading: boolean;
  bottom?: React.ReactNode; href?: string;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    spawnRipple(e, accent);
    if (href) router.push(href);
  }

  return (
    <div
      className="tc-kpi-card"
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: "#111C2E",
        border: `1px solid ${hovered ? "#2A3A54" : "#1A2640"}`,
        borderRadius: 11, padding: "12px 14px",
        position: "relative", overflow: "hidden",
        cursor: "pointer",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hovered ? "0 8px 20px -8px rgba(0,0,0,.5)" : "none",
        transition: "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
      }}
    >
      <AccentBar color={accent} taller={hovered} />
      <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "#2E4060", margin: "0 0 6px" }}>
        {label}
      </p>
      {loading ? (
        <>
          <Skeleton h={26} r={4} />
          <div style={{ marginTop: 6 }}><Skeleton h={11} w="60%" r={3} /></div>
        </>
      ) : (
        <>
          <p className="tc-kpi-value" style={{ fontWeight: 500, margin: "0 0 4px", lineHeight: 1.2, color: valueColor ?? accent }}>
            {value}
          </p>
          {bottom}
          <p style={{ fontSize: 9, color: "#253650", margin: 0 }}>{sub}</p>
        </>
      )}
    </div>
  );
}

/* Compliance card */
function ComplianceCard({ compliance, hasData, loading }: { compliance: number; hasData: boolean; loading: boolean }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  const color = !hasData ? "#2E4060"
    : compliance >= 80 ? "#50E3B8"
    : compliance >= 50 ? "#E2B96F"
    : "#F07C7C";

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    spawnRipple(e, color);
    router.push("/settings/rules");
  }

  return (
    <div
      className="tc-kpi-card"
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: "#111C2E",
        border: `1px solid ${hovered ? "#2A3A54" : "#1A2640"}`,
        borderRadius: 11, padding: "12px 14px",
        position: "relative", overflow: "hidden",
        cursor: "pointer",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hovered ? "0 8px 20px -8px rgba(0,0,0,.5)" : "none",
        transition: "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
      }}
    >
      <AccentBar color={color} taller={hovered} />
      <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "#2E4060", margin: "0 0 6px" }}>
        Rule compliance
      </p>
      {loading ? (
        <>
          <Skeleton h={26} r={4} />
          <div style={{ marginTop: 8 }}><Skeleton h={3} r={2} /></div>
        </>
      ) : (
        <>
          <p className="tc-kpi-value" style={{ fontWeight: 500, color, margin: "0 0 8px", lineHeight: 1.2 }}>
            {hasData && compliance > 0 ? `${compliance.toFixed(0)}%` : "—"}
          </p>
          <div style={{ height: 3, backgroundColor: "#1A2640", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${Math.min(compliance, 100)}%`,
              backgroundColor: color,
              borderRadius: 2,
              transition: "width 0.9s ease",
            }} />
          </div>
        </>
      )}
    </div>
  );
}

/* Equity chart custom tooltip */
function CustomEquityTooltip({ active, payload, label, formatPnl }: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: Array<any>;
  label?: string;
  formatPnl: (v: number) => string;
}) {
  if (!active || !payload?.length || !label) return null;
  const real = payload.find((p: { dataKey: string }) => p.dataKey === "real");
  if (!real) return null;
  return (
    <div style={{
      backgroundColor: "#0A1220",
      border: "1px solid #E2B96F",
      borderRadius: 7,
      padding: "6px 10px",
      fontSize: 10,
      lineHeight: 1.5,
      pointerEvents: "none",
    }}>
      <p style={{ color: "#6B8AAA", margin: "0 0 2px" }}>{label}</p>
      <p style={{ color: "#E2B96F", fontWeight: 500, margin: 0 }}>
        {(real.value as number) >= 0 ? "+" : ""}{formatPnl(real.value as number)}
      </p>
    </div>
  );
}

/* Circular discipline score ring — animates from empty on mount */
function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 36, cx = 44, cy = 44;
  const circ = 2 * Math.PI * r;
  const targetOffset = circ - (score / 100) * circ;
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    setAnimated(false);
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, [score]);

  return (
    <svg width={88} height={88} viewBox="0 0 88 88">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1A2640" strokeWidth={6} />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={circ}
        strokeDashoffset={animated ? targetOffset : circ}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: animated ? "stroke-dashoffset 1.4s cubic-bezier(.16,1,.3,1)" : "none" }}
      />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={22} fontWeight={500}
        fill={color} fontFamily="var(--font-dm-sans), DM Sans, sans-serif">{score}</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize={9}
        fill="#2E4060" fontFamily="var(--font-dm-sans), DM Sans, sans-serif">/ 100</text>
    </svg>
  );
}

/* Recent trade row */
function TradeRow({ trade }: { trade: RecentTrade }) {
  const { formatPnl } = useCurrency();
  const pnl      = trade.pnlUsd != null ? parseFloat(trade.pnlUsd) : null;
  const stripe   = pnl === null ? "#E2B96F" : pnl >= 0 ? "#50E3B8" : "#F07C7C";
  const pnlColor = pnl === null ? "#6B8AAA" : pnl >= 0 ? "#50E3B8" : "#F07C7C";
  return (
    <Link href={`/journal/${trade.id}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          display: "flex", alignItems: "stretch", marginBottom: 4,
          backgroundColor: "#0A0F1A", border: "1px solid #1A2640",
          borderRadius: 8, overflow: "hidden", cursor: "pointer",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#2A3A54"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1A2640"; }}
      >
        <div style={{ width: 3, backgroundColor: stripe, flexShrink: 0 }} />
        <div style={{
          flex: 1, padding: "8px 12px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#B0A898" }}>{trade.symbol}</span>
              <span style={{
                fontSize: 9, fontWeight: 500, borderRadius: 4, padding: "1px 6px",
                color:            trade.direction === "long" ? "#50E3B8" : "#F07C7C",
                backgroundColor:  trade.direction === "long" ? "#0D2420" : "#240808",
                border: `1px solid ${trade.direction === "long" ? "#50E3B8" : "#F07C7C"}`,
              }}>
                {trade.direction === "long" ? "Long" : "Short"}
              </span>
              {trade.session && (
                <span style={{
                  fontSize: 9, borderRadius: 4, padding: "1px 6px",
                  backgroundColor: "#0A1220", color: "#4B6080",
                  border: "1px solid #1A2640",
                }}>{sessionLabel(trade.session)}</span>
              )}
            </div>
            <span style={{ fontSize: 9, color: "#2E4060" }}>
              {fmtDate(trade.entryAt)} · {fmtTime(trade.entryAt)}
            </span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 500, color: pnlColor }}>
            {pnl === null ? "—" : pnl >= 0 ? `+${formatPnl(pnl)}` : formatPnl(pnl)}
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ─────────────────────────────── Main ── */

export default function DashboardClient({ firstName, userId }: { firstName: string; userId: string }) {
  const qc                      = useQueryClient();
  const { formatPnl, currency } = useCurrency();
  const now                     = new Date();

  const greet      = greeting(now.getUTCHours());
  const week       = weekNumber(now);
  const london     = londonStatus();
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  /* ── Discipline ring pulse on click ── */
  const ringWrapperRef = useRef<HTMLDivElement>(null);
  function handleDisciplineClick() {
    const el = ringWrapperRef.current;
    if (!el) return;
    el.classList.remove("tc-score-pulse");
    el.getBoundingClientRect(); // force reflow so animation restarts
    el.classList.add("tc-score-pulse");
  }

  /* ── Data ── */
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard", userId],
    queryFn: () => fetch("/api/dashboard").then((r) => r.json()),
    staleTime: 60_000,
  });

  /* ── Supabase Realtime ── */
  useEffect(() => {
    const sb = createClient();
    const ch = sb
      .channel(`dashboard-rt:${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "trades",
        filter: `user_id=eq.${userId}`,
      }, () => {
        setTimeout(() => {
          qc.invalidateQueries({ queryKey: ["dashboard", userId] });
          qc.invalidateQueries({ queryKey: ["trades", userId] });
        }, 2500);
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [qc, userId]);

  /* ── Milestone toasts ── */
  useEffect(() => {
    const milestones = data?.newly_achieved ?? [];
    for (const m of milestones) {
      const meta = MILESTONE_LABELS[m.milestoneKey];
      if (meta) {
        pushToast({
          id:     `${m.milestoneKey}-${m.achievedAt}`,
          icon:   meta.icon,
          header: "Milestone unlocked",
          label:  meta.label,
          accent: "#E2B96F",
        });
      }
    }
  }, [data?.newly_achieved]);

  /* ── Derived scalars ── */
  const stats        = data?.stats ?? null;
  const totalPnl     = parseFloat(stats?.totalPnl    ?? "0");
  const winRate      = parseFloat(stats?.winRate      ?? "0");
  const compliance   = parseFloat(stats?.ruleCompliancePct ?? "0");
  const phantomPnl   = data?.phantomPnl    ?? 0;
  const behavioralGap = data?.behavioralGap ?? 0;
  const monthlyPnl   = data?.monthlyPnl    ?? 0;
  const totalTrades  = data?.totalTrades   ?? 0;
  const closedTrades = stats?.closedTrades  ?? 0;

  const pnlColor        = totalPnl >= 0 ? "#50E3B8" : "#F07C7C";
  const monthlySub      = stats
    ? `This month: ${monthlyPnl >= 0 ? "+" : ""}${formatPnl(monthlyPnl)}`
    : "no trades yet";
  const monthlyBadgeAmt = `${monthlyPnl >= 0 ? "+" : ""}${formatPnl(monthlyPnl)}`;
  const monthlyBadgePos = monthlyPnl >= 0;

  const discipline      = stats?.disciplineScore != null ? Math.round(parseFloat(stats.disciplineScore)) : 0;
  const disciplineColor = discipline >= 80 ? "#50E3B8" : discipline >= 50 ? "#E2B96F" : "#F07C7C";

  /* ── Session edge ── */
  const SESSION_KEYS = ["london", "newyork", "asian", "african"];
  const sessionMap   = useMemo(() => {
    const m: Record<string, SessionEdge> = {};
    (data?.sessionEdge ?? []).forEach((s) => { m[s.session] = s; });
    return m;
  }, [data?.sessionEdge]);

  const sessions = SESSION_KEYS.map((k) =>
    sessionMap[k] ?? { session: k, total: 0, wins: 0, winRate: 0 }
  );

  const ranked = useMemo(
    () => [...sessions].filter((s) => s.total > 0).sort((a, b) => b.winRate - a.winRate),
    [sessions],
  );
  const bestKey  = ranked[0]?.session ?? null;
  const worstKey = ranked[ranked.length - 1]?.session ?? null;

  function barColor(s: SessionEdge): string {
    if (s.total === 0)           return "#1A2640";
    if (s.session === bestKey)   return "#E2B96F";
    if (s.session === worstKey)  return "#F07C7C";
    return "#8BA8C4";
  }

  /* ── Equity chart data ── */
  const equityCurve = data?.equityCurve ?? [];
  const chartData   = equityCurve.length > 0
    ? [{ date: "", real: 0, phantom: 0 }, ...equityCurve]
    : [];

  /* suppress unused-var — currency is destructured for future consumers */
  void currency;

  /* ── Render ── */
  return (
    <>
      <style>{`
        @keyframes tc-shimmer {
          0%   { background-position:  200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes tc-ripple {
          to { transform: translate(-50%, -50%) scale(4); opacity: 0; }
        }
        @keyframes tc-score-pulse {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.06); }
          100% { transform: scale(1); }
        }
        .tc-score-pulse { animation: tc-score-pulse 400ms ease-out; }
        .tc-kpi-value { font-size: 21px; }
        @media (max-width: 430px) {
          .tc-kpi-value { font-size: 15px !important; }
          .tc-kpi-card  { padding: 10px 10px 12px !important; }
        }
      `}</style>
      <ToastStack />

      <div style={{ maxWidth: 720, margin: "0 auto", paddingBottom: 64 }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: 20, paddingTop: 4 }}>
          <p style={{ fontSize: 16, fontWeight: 500, color: "#C9C2AE", margin: "0 0 4px" }}>
            {greet}, {firstName}
          </p>
          <p style={{ fontSize: 10, color: "#2E4060", margin: 0 }}>
            Week {week} · {totalTrades} trade{totalTrades !== 1 ? "s" : ""} logged
            {london && ` · ${london}`}
          </p>
        </div>

        {/* ── KPI row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>

          <KpiCard
            label="Net P&L"
            accent="#50E3B8"
            valueColor={stats ? pnlColor : "#4B6080"}
            loading={isLoading}
            value={stats ? formatPnl(totalPnl) : "—"}
            sub={monthlySub}
            href="/journal"
          />

          <KpiCard
            label="Phantom P&L"
            accent="#E2B96F"
            loading={isLoading}
            value={stats ? formatPnl(phantomPnl) : "—"}
            sub={stats ? `Behavioral gap: ${formatPnl(behavioralGap)}` : "—"}
            href="/journal"
          />

          <KpiCard
            label="Win rate"
            accent="#8BA8C4"
            loading={isLoading}
            value={stats ? `${winRate.toFixed(1)}%` : "—"}
            sub={stats ? `${closedTrades} of ${totalTrades} trades` : "no trades yet"}
            href="/analytics"
          />

          <ComplianceCard
            compliance={compliance}
            hasData={stats?.ruleCompliancePct != null}
            loading={isLoading}
          />
        </div>

        {/* ── Equity curve ── */}
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "#2E4060" }}>
              Equity curve — {monthLabel}
            </span>
            {!isLoading && stats && (
              <span style={{
                fontSize: 9, fontWeight: 500, borderRadius: 4, padding: "2px 8px",
                backgroundColor: monthlyBadgePos ? "#0D2420" : "#240808",
                color:           monthlyBadgePos ? "#50E3B8" : "#F07C7C",
                border: `1px solid ${monthlyBadgePos ? "#50E3B8" : "#F07C7C"}`,
              }}>
                {monthlyBadgeAmt}
              </span>
            )}
          </div>

          {isLoading ? (
            <Skeleton h={70} r={4} />
          ) : equityCurve.length === 0 ? (
            <div style={{ height: 70, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12, color: "#2E4060" }}>
                No closed trades yet — your equity curve will appear here
              </span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={70}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="tcGoldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#E2B96F" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#E2B96F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <ReferenceLine y={0} stroke="#1A2640" strokeDasharray="3 3" />
                <Tooltip content={<CustomEquityTooltip formatPnl={formatPnl} />} />
                <Area
                  type="monotone" dataKey="real"
                  stroke="#E2B96F" strokeWidth={1.5}
                  fill="url(#tcGoldGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#E2B96F", stroke: "#0A0F1A", strokeWidth: 2 }}
                />
                <Line
                  type="monotone" dataKey="phantom"
                  stroke="#E2B96F" strokeWidth={0.8}
                  strokeDasharray="4 3" strokeOpacity={0.35}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {!isLoading && equityCurve.length > 0 && (
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 16, height: 1.5, backgroundColor: "#E2B96F" }} />
                <span style={{ fontSize: 9, color: "#4B6080" }}>Actual P&L</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 16, height: 0, borderTop: "1.5px dashed #E2B96F", opacity: 0.5 }} />
                <span style={{ fontSize: 9, color: "#4B6080" }}>Phantom P&L (rule-perfect)</span>
              </div>
            </div>
          )}
        </Card>

        {/* ── Recent trades ── */}
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "#2E4060" }}>
              Recent trades
            </span>
            <Link href="/journal" style={{ fontSize: 11, color: "#4B6080", textDecoration: "none" }}>
              View all →
            </Link>
          </div>

          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={48} r={6} />)}
            </div>
          ) : (data?.recentTrades ?? []).length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <p style={{ fontSize: 12, color: "#4B6080", margin: "0 0 12px" }}>No trades logged yet.</p>
              <Link href="/journal/new" style={{
                display: "inline-flex", alignItems: "center",
                height: 34, padding: "0 14px", borderRadius: 8,
                backgroundColor: "#E2B96F", color: "#0A0F1A",
                fontSize: 12, fontWeight: 500, textDecoration: "none",
              }}>
                + Log your first trade
              </Link>
            </div>
          ) : (
            (data?.recentTrades ?? []).map((t) => <TradeRow key={t.id} trade={t} />)
          )}
        </Card>

        {/* ── Session edge + Discipline score ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>

          <Card>
            <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "#2E4060", margin: "0 0 12px" }}>
              Session edge
            </p>
            {isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={14} r={3} />)}
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sessions.map((s) => {
                    const bc = barColor(s);
                    return (
                      <div key={s.session} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 9, color: "#2E4060", width: 58, flexShrink: 0 }}>
                          {sessionLabel(s.session)}
                        </span>
                        <div style={{ flex: 1, height: 3, backgroundColor: "#1A2640", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{
                            height: "100%",
                            width: s.total > 0 ? `${s.winRate}%` : "0%",
                            backgroundColor: bc, borderRadius: 2,
                            transition: "width 0.9s ease",
                          }} />
                        </div>
                        <span style={{ fontSize: 9, color: s.total > 0 ? bc : "#2E4060", width: 26, textAlign: "right" }}>
                          {s.total > 0 ? `${s.winRate}%` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {bestKey && (
                  <p style={{ fontSize: 10, color: "#6B8AAA", margin: "12px 0 0" }}>
                    Your edge is the{" "}
                    <span style={{ color: "#E2B96F", fontWeight: 500 }}>{sessionLabel(bestKey)}</span>{" "}
                    session
                  </p>
                )}
              </>
            )}
          </Card>

          <Card
            style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
            onClick={handleDisciplineClick}
          >
            <p style={{
              fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em",
              color: "#2E4060", margin: "0 0 10px", alignSelf: "flex-start",
            }}>
              Discipline score
            </p>
            {isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <Skeleton w={88} h={88} r={44} />
                <Skeleton w={100} h={11} r={3} />
              </div>
            ) : (
              <>
                <div ref={ringWrapperRef}>
                  <ScoreRing score={discipline} color={disciplineColor} />
                </div>
                <p style={{ fontSize: 9, color: "#2E4060", margin: "8px 0 0", textAlign: "center" }}>
                  {stats?.currentStreak
                    ? `${stats.currentStreak}-day compliance streak`
                    : "Start your streak today"}
                </p>
              </>
            )}
          </Card>

        </div>
      </div>
    </>
  );
}
