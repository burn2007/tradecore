"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { useState, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
interface HeatmapDay {
  date: string;
  violation_count: number;
  trade_count: number;
}

interface SetupPerf {
  setup_tag: string;
  win_rate: number;
  trade_count: number;
  avg_pnl: number;
}

interface SessionRow {
  session: string;
  win_rate: number;
  trade_count: number;
  avg_pnl: number;
}

interface SignalRow {
  signal_source: string;
  win_rate: number;
  trade_count: number;
}

interface AnalyticsData {
  heatmap_data: HeatmapDay[];
  setup_performance: SetupPerf[];
  session_breakdown: SessionRow[];
  signal_accuracy: SignalRow[];
  overall_win_rate: number;
  worst_day_of_week: string | null;
  best_session: string | null;
  worst_session: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function cellBg(violations: number | undefined, hasTraded: boolean) {
  if (!hasTraded) return "#0A1018";
  if (violations === 0) return "#0D2A20";
  if (violations === 1) return "#2A1A08";
  if (violations === 2) return "#3A1A1A";
  return "#5A1A1A";
}

function sessionLabel(s: string) {
  const map: Record<string, string> = {
    london: "London",
    newyork: "New York",
    asian: "Asian",
    african: "African",
  };
  return map[s] ?? s;
}

// ── Shared card wrapper ────────────────────────────────────────────────────
function Card({
  accent,
  children,
  style,
}: {
  accent?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="dusk-card"
      style={{
        padding: "1.25rem 1.375rem",
        borderTop: `2px solid ${accent ?? "var(--color-jade)"}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({ label }: { label: string }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--color-text-muted)",
      }}
    >
      {label}
    </p>
  );
}

function Insight({ text }: { text: string }) {
  return (
    <p
      style={{
        margin: "10px 0 0",
        fontSize: 10,
        color: "var(--color-text-secondary)",
        lineHeight: 1.6,
      }}
    >
      {text}
    </p>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function SkeletonBlock({ h = 120 }: { h?: number }) {
  return (
    <div
      style={{
        height: h,
        borderRadius: 8,
        background:
          "linear-gradient(90deg,#111C2E 25%,#162033 50%,#111C2E 75%)",
        backgroundSize: "200% 100%",
        animation: "tc-shimmer 1.6s linear infinite",
      }}
    />
  );
}

// ── Section 1: Mistake Heatmap ─────────────────────────────────────────────
function MistakeHeatmap({ data, worstDay }: { data: HeatmapDay[]; worstDay: string | null }) {
  const [tooltip, setTooltip] = useState<{
    date: string;
    violations: number;
    trades: number;
    x: number;
    y: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const dataMap = new Map(data.map((d) => [d.date, d]));

  // Build Mon–Fri grid for 6 weeks
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start from 30 days ago, padded back to Monday
  const base = new Date(today);
  base.setDate(today.getDate() - 29);
  const padBack = base.getDay() === 0 ? 6 : base.getDay() - 1;
  base.setDate(base.getDate() - padBack);

  // Build 6 columns (weeks) × 5 rows (Mon–Fri)
  const weeks: { date: string; inRange: boolean }[][] = [];
  for (let week = 0; week < 6; week++) {
    const row: { date: string; inRange: boolean }[] = [];
    for (let day = 0; day < 5; day++) {
      const d = new Date(base);
      d.setDate(base.getDate() + week * 7 + day);
      const dateStr = d.toISOString().slice(0, 10);
      const inRange = d >= new Date(today.getTime() - 29 * 86400000) && d <= today;
      row.push({ date: dateStr, inRange });
    }
    weeks.push(row);
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <Card accent="var(--color-rose)">
      <CardHeader label="30-day mistake heatmap" />

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, marginTop: 10, alignItems: "center" }}>
        {[
          { bg: "#0D2A20", label: "No mistakes" },
          { bg: "#2A1A08", label: "1 violation" },
          { bg: "#5A1A1A", label: "2+ violations" },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: l.bg,
                border: "1px solid #1A2640",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 9, color: "var(--color-text-secondary)" }}>{l.label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: "#0A1018",
              border: "1px solid #1A2640",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 9, color: "var(--color-text-secondary)" }}>No trades</span>
        </div>
      </div>

      {/* Grid — columns = weeks, rows = Mon–Fri */}
      <div
        ref={containerRef}
        style={{ marginTop: 12, position: "relative" }}
        onMouseLeave={() => setTooltip(null)}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(6, 1fr)`,
            gap: 3,
          }}
        >
          {weeks.map((week, wi) =>
            week.map((cell, di) => {
              const entry = dataMap.get(cell.date);
              const hasTraded = !!entry && entry.trade_count > 0;
              const violations = entry?.violation_count ?? 0;
              const bg = cell.inRange ? cellBg(violations, hasTraded) : "#0A1018";

              return (
                <div
                  key={`${wi}-${di}`}
                  style={{
                    height: 14,
                    borderRadius: 2,
                    background: bg,
                    border: "1px solid rgba(255,255,255,0.04)",
                    cursor: cell.inRange ? "pointer" : "default",
                    transition: "filter 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!cell.inRange) return;
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                    const parentRect = containerRef.current!.getBoundingClientRect();
                    setTooltip({
                      date: cell.date,
                      violations: violations,
                      trades: entry?.trade_count ?? 0,
                      x: rect.left - parentRect.left + rect.width / 2,
                      y: rect.top - parentRect.top - 8,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })
          )}
        </div>

        {/* Day-of-week labels */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 3,
            marginTop: 4,
          }}
        >
          {weeks[0].map((_, di) => (
            <span
              key={di}
              style={{
                fontSize: 9,
                color: "var(--color-text-muted)",
                textAlign: "center",
              }}
            >
              {["Mon", "Tue", "Wed", "Thu", "Fri"][di]}
            </span>
          ))}
          {/* Empty cells for remaining columns */}
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={`empty-${i}`} />
          ))}
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: "absolute",
              left: tooltip.x,
              top: tooltip.y,
              transform: "translate(-50%, -100%)",
              background: "#0A0F1A",
              border: "1px solid var(--color-border)",
              borderRadius: 6,
              padding: "6px 10px",
              pointerEvents: "none",
              zIndex: 20,
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--color-text-primary)", fontWeight: 500 }}>
              {formatDate(tooltip.date)}
            </div>
            <div style={{ fontSize: 9, color: "var(--color-text-secondary)", marginTop: 2 }}>
              {tooltip.violations} violation{tooltip.violations !== 1 ? "s" : ""} · {tooltip.trades} trade{tooltip.trades !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>

      {worstDay && (
        <Insight text={`You break rules most on ${worstDay}. Consider skipping or reducing position size on those days.`} />
      )}
    </Card>
  );
}

// ── Section 2: Setup Performance ───────────────────────────────────────────
function SetupPerformance({
  data,
  overallWinRate,
}: {
  data: SetupPerf[];
  overallWinRate: number;
}) {
  const qualified = data.filter((s) => s.trade_count >= 3);
  if (qualified.length < 2) {
    return (
      <Card accent="var(--color-gold)">
        <CardHeader label="Setup performance" />
        <p
          style={{
            margin: "20px 0 0",
            fontSize: 11,
            color: "var(--color-text-secondary)",
            textAlign: "center",
          }}
        >
          Log more trades with setup tags to see performance breakdown here.
        </p>
      </Card>
    );
  }

  const chartData = qualified.map((s) => ({
    name: s.setup_tag,
    winRate: s.win_rate,
    tradeCount: s.trade_count,
    fill:
      s.win_rate > overallWinRate
        ? "#50E3B8"
        : s.win_rate >= overallWinRate - 10
        ? "#E2B96F"
        : "#F07C7C",
  }));

  const best = qualified[0];
  const worst = qualified[qualified.length - 1];

  return (
    <Card accent="var(--color-gold)">
      <CardHeader label="Setup performance" />
      <div style={{ marginTop: 14 }}>
        <ResponsiveContainer width="100%" height={Math.max(80, chartData.length * 32)}>
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 0, right: 120, left: 0, bottom: 0 }}
          >
            <XAxis
              type="number"
              domain={[0, 100]}
              hide
              tick={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine
              x={50}
              stroke="var(--color-ice)"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
            <ReferenceLine
              x={overallWinRate}
              stroke="var(--color-text-muted)"
              strokeDasharray="3 3"
              strokeOpacity={0.6}
            />
            <Bar dataKey="winRate" radius={2} barSize={10}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Manual labels on right (Recharts LabelList struggles with vertical layout) */}
        <div
          style={{
            position: "relative",
            marginTop: -Math.max(80, chartData.length * 32),
            pointerEvents: "none",
            height: Math.max(80, chartData.length * 32),
            paddingLeft: "calc(100% - 115px)",
          }}
        >
          {chartData.map((d, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                top: i * 32 + 11,
                left: 0,
                fontSize: 9,
                color: "var(--color-text-secondary)",
                whiteSpace: "nowrap",
              }}
            >
              {d.winRate}% ({d.tradeCount} trades)
            </div>
          ))}
        </div>
      </div>

      <Insight
        text={`Your best setup is ${best.setup_tag} at ${best.win_rate}% win rate. Your worst is ${worst.setup_tag} at ${worst.win_rate}% win rate.`}
      />
    </Card>
  );
}

// ── Section 3: Session Breakdown ───────────────────────────────────────────
function SessionBreakdown({
  data,
  bestSession,
  worstSession,
}: {
  data: SessionRow[];
  bestSession: string | null;
  worstSession: string | null;
}) {
  const ORDER = ["london", "newyork", "asian", "african"];
  const sorted = [...data].sort(
    (a, b) => ORDER.indexOf(a.session) - ORDER.indexOf(b.session)
  );

  const best = data.find((d) => d.session === bestSession);
  const worst = data.find((d) => d.session === worstSession);

  const wrColor = (wr: number) => {
    if (wr >= 55) return "var(--color-jade)";
    if (wr >= 45) return "var(--color-gold)";
    return "var(--color-rose)";
  };

  const barColor = (wr: number) => {
    if (wr >= 55) return "var(--color-jade)";
    if (wr >= 45) return "var(--color-gold)";
    return "var(--color-rose)";
  };

  return (
    <Card accent="var(--color-ice)">
      <CardHeader label="Session edge" />
      <div style={{ marginTop: 12 }}>
        {sorted.map((row, i) => (
          <div
            key={row.session}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "9px 0",
              borderBottom:
                i < sorted.length - 1
                  ? "0.5px solid var(--color-border-subtle)"
                  : "none",
              gap: 8,
            }}
          >
            {/* Session name */}
            <span
              style={{
                width: 70,
                fontSize: 10,
                color: "var(--color-text-secondary)",
                flexShrink: 0,
              }}
            >
              {sessionLabel(row.session)}
            </span>

            {/* Trade count */}
            <span
              style={{
                width: 50,
                fontSize: 9,
                color: "var(--color-text-muted)",
                flexShrink: 0,
              }}
            >
              {row.trade_count} trades
            </span>

            {/* Bar track */}
            <div
              style={{
                flex: 1,
                height: 4,
                background: "#1A2640",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: row.trade_count > 0 ? `${(row.win_rate / 100) * 100}%` : "0%",
                  background: barColor(row.win_rate),
                  borderRadius: 2,
                  transition: "width 0.4s ease",
                }}
              />
            </div>

            {/* Win rate */}
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: row.trade_count > 0 ? wrColor(row.win_rate) : "var(--color-text-muted)",
                width: 38,
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              {row.trade_count > 0 ? `${row.win_rate}%` : "—"}
            </span>
          </div>
        ))}
      </div>

      {best && worst && best.session !== worst.session && (
        <Insight
          text={`Trade ${sessionLabel(best.session)} and avoid ${sessionLabel(worst.session)}. Your ${sessionLabel(best.session)} win rate is ${best.win_rate}% vs ${sessionLabel(worst.session)} at ${worst.win_rate}%.`}
        />
      )}
    </Card>
  );
}

// ── Signal Accuracy ────────────────────────────────────────────────────────
function SignalAccuracy({ data }: { data: SignalRow[] }) {
  if (data.length === 0) return null;

  return (
    <Card accent="var(--color-gold)" style={{ marginTop: 16 }}>
      <CardHeader label="Signal provider accuracy" />
      <div style={{ marginTop: 12 }}>
        {data.map((row, i) => (
          <div key={row.signal_source}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 0",
                borderBottom:
                  i < data.length - 1
                    ? "0.5px solid var(--color-border-subtle)"
                    : "none",
                gap: 8,
              }}
            >
              {/* Source name */}
              <span
                style={{
                  width: 110,
                  fontSize: 10,
                  color: "var(--color-text-secondary)",
                  flexShrink: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {row.signal_source}
              </span>

              {/* Bar */}
              <div
                style={{
                  flex: 1,
                  height: 4,
                  background: "#1A2640",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${row.win_rate}%`,
                    background:
                      row.win_rate >= 55
                        ? "var(--color-jade)"
                        : row.win_rate >= 45
                        ? "var(--color-gold)"
                        : "var(--color-rose)",
                    borderRadius: 2,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>

              {/* Win rate + count */}
              <span
                style={{
                  fontSize: 9,
                  color: "var(--color-text-secondary)",
                  whiteSpace: "nowrap",
                }}
              >
                {row.win_rate}% ({row.trade_count} trades)
              </span>
            </div>

            {/* Losing source warning */}
            {row.win_rate < 40 && (
              <p
                style={{
                  margin: "4px 0 6px",
                  fontSize: 10,
                  color: "var(--color-rose)",
                  lineHeight: 1.5,
                }}
              >
                {row.signal_source} signals are losing you money — {row.win_rate}% win rate over {row.trade_count} trades.
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Main AnalyticsClient ───────────────────────────────────────────────────
export default function AnalyticsClient({ userId }: { userId: string }) {
  const { data, isLoading, isError } = useQuery<AnalyticsData>({
    queryKey: ["analytics", userId],
    queryFn: () => fetch("/api/analytics").then((r) => r.json()),
    staleTime: 60_000,
  });

  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "28px 20px 60px",
      }}
    >
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: "var(--color-text-primary)",
            margin: 0,
          }}
        >
          Analytics
        </h1>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 11,
            color: "var(--color-text-secondary)",
          }}
        >
          30-day pattern analysis — updated on every trade log
        </p>
      </div>

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SkeletonBlock h={160} />
          <SkeletonBlock h={200} />
          <SkeletonBlock h={180} />
        </div>
      )}

      {isError && (
        <p style={{ color: "var(--color-rose)", fontSize: 12 }}>
          Failed to load analytics. Please refresh.
        </p>
      )}

      {data && !isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Section 1 */}
          <MistakeHeatmap
            data={data.heatmap_data}
            worstDay={data.worst_day_of_week}
          />

          {/* Section 2 */}
          <SetupPerformance
            data={data.setup_performance}
            overallWinRate={data.overall_win_rate}
          />

          {/* Section 3 */}
          <SessionBreakdown
            data={data.session_breakdown}
            bestSession={data.best_session}
            worstSession={data.worst_session}
          />

          {/* Signal accuracy (conditional) */}
          {data.signal_accuracy.length > 0 && (
            <SignalAccuracy data={data.signal_accuracy} />
          )}
        </div>
      )}
    </div>
  );
}
