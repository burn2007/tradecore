"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { parseMT5CSV, type ParsedTrade, type ParseResult } from "@/lib/csv-parser";
import { useNavLock } from "@/components/layout/NavLockContext";

/* ═══════════════════════════════════════════════════════════════
   Types & constants
═══════════════════════════════════════════════════════════════ */

type Step = "upload" | "preview" | "importing" | "complete";

const CHUNK_SIZE = 100; // trades per API batch

/* ═══════════════════════════════════════════════════════════════
   Style constants (Dusk design)
═══════════════════════════════════════════════════════════════ */

const CARD: React.CSSProperties = {
  backgroundColor: "#111C2E",
  border: "1px solid #1A2640",
  borderRadius: 11,
  padding: "20px",
  marginBottom: 12,
};

/* ═══════════════════════════════════════════════════════════════
   Helpers
═══════════════════════════════════════════════════════════════ */

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtPnl(val: string | null): string {
  if (!val) return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}$${Math.abs(n).toFixed(2)}`;
}

/* ═══════════════════════════════════════════════════════════════
   Step indicator
═══════════════════════════════════════════════════════════════ */

const STEPS: { key: Step; label: string }[] = [
  { key: "upload",    label: "Upload" },
  { key: "preview",   label: "Preview" },
  { key: "importing", label: "Importing" },
  { key: "complete",  label: "Complete" },
];

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 28, gap: 0 }}>
      {STEPS.map((step, idx) => {
        const done    = idx < currentIdx;
        const active  = idx === currentIdx;
        const isLast  = idx === STEPS.length - 1;
        return (
          <div key={step.key} style={{ display: "flex", alignItems: "center", flex: isLast ? 0 : 1 }}>
            {/* Circle */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 500,
                backgroundColor: active ? "#E2B96F" : done ? "#0D2420" : "#0A0F1A",
                border: `1px solid ${active ? "#E2B96F" : done ? "#50E3B8" : "#1A2640"}`,
                color: active ? "#0A0F1A" : done ? "#50E3B8" : "#2E4060",
                flexShrink: 0,
              }}>
                {done ? (
                  <svg viewBox="0 0 12 10" width="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="1,5 4.5,9 11,1" />
                  </svg>
                ) : (idx + 1)}
              </div>
              <span style={{
                fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em",
                color: active ? "#E2B96F" : done ? "#50E3B8" : "#2E4060",
                fontWeight: active ? 500 : 400, whiteSpace: "nowrap",
              }}>{step.label}</span>
            </div>
            {/* Connector line */}
            {!isLast && (
              <div style={{
                flex: 1, height: 1, margin: "0 8px",
                marginBottom: 20,
                backgroundColor: done ? "#50E3B8" : "#1A2640",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════════════════ */

export default function ImportClient() {
  const { setLocked } = useNavLock();
  const [step,        setStep]        = useState<Step>("upload");
  const [dragOver,    setDragOver]    = useState(false);
  const [file,        setFile]        = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parseError,  setParseError]  = useState("");
  const [showMTGuide, setShowMTGuide] = useState(false);

  // Importing state
  const [importProgress, setImportProgress] = useState(0);  // 0–100
  const [importCurrent,  setImportCurrent]  = useState(0);
  const [importTotal,    setImportTotal]    = useState(0);

  // Complete state
  const [importedCount,    setImportedCount]    = useState(0);
  const [duplicatesCount,  setDuplicatesCount]  = useState(0);
  const [importError,      setImportError]      = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  /* Lock app nav (Topbar/Sidebar/BottomTabBar) while a batch import is in flight */
  useEffect(() => {
    setLocked(step === "importing");
    return () => setLocked(false);
  }, [step, setLocked]);

  /* Warn on tab close/refresh while a batch import is in flight */
  useEffect(() => {
    if (step !== "importing") return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [step]);

  /* ── File selection handler ── */
  const handleFile = useCallback((selected: File) => {
    setParseError("");
    if (!selected.name.toLowerCase().endsWith(".csv")) {
      setParseError("This file does not appear to be a valid CSV. Please export your history from MetaTrader as a CSV file.");
      return;
    }
    setFile(selected);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content || content.trim().length === 0) {
        setParseError("This file does not appear to be a valid CSV. Please export your history from MetaTrader as a CSV file.");
        return;
      }
      try {
        const result = parseMT5CSV(content);
        if (result.trades.length === 0) {
          setParseError(
            "No trades were found in this file. Make sure you exported your full account history and not just open positions."
          );
          return;
        }
        setParseResult(result);
        setStep("preview");
      } catch {
        setParseError("This file does not appear to be a valid CSV. Please export your history from MetaTrader as a CSV file.");
      }
    };
    reader.readAsText(selected);
  }, []);

  /* ── Import handler — chunked POSTs for progress feedback ── */
  async function handleImport() {
    if (!parseResult) return;
    const allTrades: ParsedTrade[] = parseResult.trades;
    const total = allTrades.length;
    setImportTotal(total);
    setImportCurrent(0);
    setImportProgress(0);
    setImportError("");
    setStep("importing");

    let totalImported = 0;
    let totalDuplicates = 0;
    let chunksDone = 0;
    const numChunks = Math.ceil(total / CHUNK_SIZE);

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      const chunk = allTrades.slice(i, i + CHUNK_SIZE);

      // Serialise Dates to ISO strings for JSON transport
      const serialized = chunk.map((t) => ({
        ...t,
        entry_at: t.entry_at instanceof Date ? t.entry_at.toISOString() : t.entry_at,
        exit_at: t.exit_at instanceof Date ? t.exit_at.toISOString() : t.exit_at,
      }));

      try {
        const res = await fetch("/api/trades/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trades: serialized }),
        });

        if (!res.ok) {
          setImportError("Import failed. Your trades were not saved. Please try again.");
          setStep("preview");
          return;
        }

        const data = await res.json() as { imported: number; duplicates_skipped: number; failed: number };
        totalImported   += data.imported;
        totalDuplicates += data.duplicates_skipped;
      } catch {
        setImportError("Import failed. Your trades were not saved. Please try again.");
        setStep("preview");
        return;
      }

      chunksDone++;
      const done = Math.min(i + CHUNK_SIZE, total);
      setImportCurrent(done);
      setImportProgress(Math.round((chunksDone / numChunks) * 100));
    }

    setImportedCount(totalImported);
    setDuplicatesCount(totalDuplicates);
    setStep("complete");
  }

  /* ── Reset ── */
  function reset() {
    setStep("upload");
    setFile(null);
    setParseResult(null);
    setParseError("");
    setImportError("");
    setImportProgress(0);
  }

  /* ═══════════════════════════════════════════════════════════
     Render
  ═══════════════════════════════════════════════════════════ */

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", paddingBottom: 80 }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Link
            href="/journal"
            tabIndex={step === "importing" ? -1 : undefined}
            aria-disabled={step === "importing"}
            onClick={(e) => { if (step === "importing") e.preventDefault(); }}
            style={{
              fontSize: 12, color: "#4B6080", textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
              pointerEvents: step === "importing" ? "none" : "auto",
              opacity: step === "importing" ? 0.4 : 1,
            }}
          >
            <svg viewBox="0 0 8 14" width="6" fill="none" stroke="#4B6080" strokeWidth="2" strokeLinecap="round"><path d="M7 1L1 7l6 6" /></svg>
            Journal
          </Link>
          <span style={{ color: "#1A2640", fontSize: 12 }}>/</span>
          <span style={{ fontSize: 12, color: "#6B8AAA" }}>Import CSV</span>
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 500, color: "#C9C2AE", margin: "0 0 4px" }}>
          Import trading history
        </h1>
        <p style={{ fontSize: 12, color: "#6B8AAA", margin: 0 }}>
          Import years of trades from your MT4 or MT5 broker export instantly.
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* ── STEP 1: UPLOAD ── */}
      {step === "upload" && (
        <>
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            onClick={() => fileRef.current?.click()}
            style={{
              backgroundColor: dragOver ? "#0D1A28" : "#0A0F1A",
              border: `1.5px dashed ${dragOver ? "#50E3B8" : file ? "#50E3B8" : "#1A2640"}`,
              borderRadius: 10,
              padding: "40px 24px",
              textAlign: "center",
              cursor: "pointer",
              marginBottom: 12,
              transition: "border-color 0.15s, background-color 0.15s",
            } as React.CSSProperties}
          >
            {file ? (
              /* File selected state */
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <svg viewBox="0 0 40 40" width="36" fill="none">
                  <rect x="6" y="4" width="28" height="32" rx="4" fill="#0D2420" stroke="#50E3B8" strokeWidth="1.5" />
                  <path d="M13 22l5 5 9-10" stroke="#50E3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#50E3B8", margin: 0 }}>
                  {file.name}
                </p>
                <p style={{ fontSize: 10, color: "#2E4060", margin: 0 }}>
                  {fmtBytes(file.size)} — parsing…
                </p>
              </div>
            ) : (
              /* Default state */
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                {/* Upload arrow SVG */}
                <svg viewBox="0 0 40 40" width="32" fill="none" stroke="#2E4060" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 28V12M13 19l7-7 7 7" />
                  <path d="M8 32h24" />
                </svg>
                <p style={{ fontSize: 13, color: "#6B8AAA", margin: 0, fontWeight: 500 }}>
                  Drop your MT4/MT5 history export here
                </p>
                <p style={{ fontSize: 10, color: "#2E4060", margin: 0 }}>
                  or tap to browse — accepts .csv files only
                </p>
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {/* Error */}
          {parseError && (
            <div style={{
              backgroundColor: "#240808",
              border: "1px solid #F07C7C",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 12,
            }}>
              <p style={{ fontSize: 12, color: "#F07C7C", margin: 0, lineHeight: 1.6 }}>
                {parseError}
              </p>
            </div>
          )}

          {/* Collapsible MT guide */}
          <div style={CARD}>
            <button
              type="button"
              onClick={() => setShowMTGuide((p) => !p)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", background: "none", border: "none", cursor: "pointer",
                padding: 0, fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: 12, color: "#6B8AAA", fontWeight: 500 }}>
                How to export from MetaTrader
              </span>
              <svg
                viewBox="0 0 10 6" width="10" fill="#4B6080"
                style={{ transform: showMTGuide ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}
              >
                <path d="M0 0l5 6 5-6H0z" />
              </svg>
            </button>

            {showMTGuide && (
              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* MT5 */}
                <div>
                  <p style={{
                    fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em",
                    color: "#E2B96F", fontWeight: 500, margin: "0 0 10px",
                  }}>MetaTrader 5</p>
                  {[
                    "Open the terminal (Ctrl+T)",
                    "Click the History tab",
                    "Right-click anywhere in the list",
                    "Select Save as Report",
                    "Choose CSV format",
                    "Save the file",
                  ].map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7 }}>
                      <span style={{
                        fontSize: 9, color: "#E2B96F", fontWeight: 500,
                        width: 14, flexShrink: 0, paddingTop: 1,
                      }}>{i + 1}.</span>
                      <p style={{ fontSize: 10, color: "#6B8AAA", margin: 0, lineHeight: 1.55 }}>{step}</p>
                    </div>
                  ))}
                </div>

                {/* MT4 */}
                <div>
                  <p style={{
                    fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em",
                    color: "#8BA8C4", fontWeight: 500, margin: "0 0 10px",
                  }}>MetaTrader 4</p>
                  {[
                    "Open the terminal (Ctrl+T)",
                    "Click Account History tab",
                    "Right-click anywhere",
                    "Select Save as Detailed Report",
                    "Note: saves as .htm — open in Excel, then File → Save As → CSV",
                    "Upload the CSV here",
                  ].map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7 }}>
                      <span style={{
                        fontSize: 9, color: "#8BA8C4", fontWeight: 500,
                        width: 14, flexShrink: 0, paddingTop: 1,
                      }}>{i + 1}.</span>
                      <p style={{ fontSize: 10, color: "#6B8AAA", margin: 0, lineHeight: 1.55 }}>{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── STEP 2: PREVIEW ── */}
      {step === "preview" && parseResult && (
        <>
          {/* Summary bar */}
          <div style={{
            ...CARD,
            borderLeft: "3px solid #50E3B8",
            padding: "14px 18px",
          }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#C9C2AE", margin: "0 0 4px" }}>
              Found <span style={{ color: "#50E3B8" }}>{parseResult.trades.length.toLocaleString()} trade{parseResult.trades.length !== 1 ? "s" : ""}</span>
              {parseResult.date_range.earliest && (
                <> from {fmtDate(parseResult.date_range.earliest)} to {fmtDate(parseResult.date_range.latest)}</>
              )}
            </p>
            {(parseResult.skipped_non_trades > 0 || parseResult.failed_rows > 0) && (
              <p style={{ fontSize: 11, color: "#E2B96F", margin: 0, marginTop: 4 }}>
                {parseResult.skipped_non_trades > 0 && (
                  <>{parseResult.skipped_non_trades} non-trade row{parseResult.skipped_non_trades !== 1 ? "s" : ""} skipped (deposits, corrections){parseResult.failed_rows > 0 ? " · " : ""}</>
                )}
                {parseResult.failed_rows > 0 && (
                  <>{parseResult.failed_rows} row{parseResult.failed_rows !== 1 ? "s" : ""} could not be parsed</>
                )}
              </p>
            )}
          </div>

          {/* Preview table — first 5 trades */}
          <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#0A0F1A" }}>
                    {["Date", "Symbol", "Direction", "Size", "Entry", "Exit", "P&L"].map((h) => (
                      <th key={h} style={{
                        fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em",
                        color: "#2E4060", fontWeight: 500,
                        padding: "10px 12px", textAlign: "left", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parseResult.trades.slice(0, 5).map((t, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #0F1A2A" }}>
                      <td style={{ fontSize: 10, color: "#6B8AAA", padding: "9px 12px", whiteSpace: "nowrap" }}>
                        {fmtDate(t.entry_at)}
                      </td>
                      <td style={{ fontSize: 10, color: "#C9C2AE", padding: "9px 12px", fontWeight: 500 }}>
                        {t.symbol}
                      </td>
                      <td style={{ fontSize: 10, padding: "9px 12px" }}>
                        <span style={{
                          color: t.direction === "long" ? "#50E3B8" : "#F07C7C",
                          backgroundColor: t.direction === "long" ? "#0D2420" : "#240808",
                          border: `1px solid ${t.direction === "long" ? "#50E3B8" : "#F07C7C"}`,
                          borderRadius: 4, padding: "1px 6px", fontSize: 9, fontWeight: 500,
                        }}>
                          {t.direction === "long" ? "Long" : "Short"}
                        </span>
                      </td>
                      <td style={{ fontSize: 10, color: "#6B8AAA", padding: "9px 12px" }}>
                        {t.size_lots}
                      </td>
                      <td style={{ fontSize: 10, color: "#6B8AAA", padding: "9px 12px" }}>
                        {t.entry_price}
                      </td>
                      <td style={{ fontSize: 10, color: "#6B8AAA", padding: "9px 12px" }}>
                        {t.exit_price ?? "—"}
                      </td>
                      <td style={{
                        fontSize: 10, padding: "9px 12px", fontWeight: 500,
                        color: t.pnl_usd
                          ? (parseFloat(t.pnl_usd) >= 0 ? "#50E3B8" : "#F07C7C")
                          : "#4B6080",
                      }}>
                        {fmtPnl(t.pnl_usd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parseResult.trades.length > 5 && (
              <p style={{ fontSize: 10, color: "#2E4060", padding: "8px 12px", margin: 0 }}>
                Showing first 5 of {parseResult.trades.length.toLocaleString()} trades
              </p>
            )}
          </div>

          {/* Import error */}
          {importError && (
            <div style={{
              backgroundColor: "#240808", border: "1px solid #F07C7C",
              borderRadius: 8, padding: "10px 14px", marginBottom: 12,
            }}>
              <p style={{ fontSize: 12, color: "#F07C7C", margin: "0 0 8px", lineHeight: 1.6 }}>
                {importError}
              </p>
              <button
                type="button"
                onClick={() => { setImportError(""); handleImport(); }}
                style={{
                  fontSize: 11, color: "#F07C7C", background: "none", border: "1px solid #F07C7C",
                  borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Retry import
              </button>
            </div>
          )}

          {/* Import button */}
          <button
            type="button"
            onClick={handleImport}
            style={{
              width: "100%", height: 44, backgroundColor: "#E2B96F",
              border: "none", borderRadius: 8, color: "#0A0F1A",
              fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              marginBottom: 12,
            }}
          >
            Import {parseResult.trades.length.toLocaleString()} trade{parseResult.trades.length !== 1 ? "s" : ""}
          </button>

          <div style={{ textAlign: "center" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                fontSize: 12, color: "#4B6080", background: "none", border: "none",
                cursor: "pointer", fontFamily: "inherit", textDecoration: "underline",
              }}
            >
              Choose a different file
            </button>
          </div>
        </>
      )}

      {/* ── STEP 3: IMPORTING ── */}
      {step === "importing" && (
        <div style={CARD}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#C9C2AE", margin: "0 0 16px" }}>
            Importing your trades…
          </p>

          {/* Progress bar */}
          <div style={{
            width: "100%", height: 6, backgroundColor: "#1A2640",
            borderRadius: 3, overflow: "hidden", marginBottom: 10,
          }}>
            <div style={{
              height: "100%", backgroundColor: "#50E3B8",
              borderRadius: 3,
              width: `${importProgress}%`,
              transition: "width 0.3s ease",
            }} />
          </div>

          <p style={{ fontSize: 11, color: "#6B8AAA", margin: "0 0 20px" }}>
            Importing {importCurrent.toLocaleString()} of {importTotal.toLocaleString()} trades…
          </p>

          {/* Disable nav hint */}
          <div style={{
            backgroundColor: "#0A0F1A", border: "1px solid #1A2640",
            borderRadius: 8, padding: "10px 14px",
          }}>
            <p style={{ fontSize: 11, color: "#4B6080", margin: 0 }}>
              ⚠️ Please don&apos;t close this tab — import is in progress.
            </p>
          </div>
        </div>
      )}

      {/* ── STEP 4: COMPLETE ── */}
      {step === "complete" && (
        <div style={{ ...CARD, textAlign: "center", padding: "40px 24px" }}>
          {/* Checkmark */}
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            backgroundColor: "#0D2420", border: "2px solid #50E3B8",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <svg viewBox="0 0 28 22" width="28" fill="none" stroke="#50E3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2,11 10,19 26,2" />
            </svg>
          </div>

          <p style={{ fontSize: 15, fontWeight: 500, color: "#C9C2AE", margin: "0 0 8px" }}>
            Import complete
          </p>
          <p style={{ fontSize: 12, color: "#6B8AAA", margin: "0 0 28px", lineHeight: 1.6 }}>
            <span style={{ color: "#50E3B8", fontWeight: 500 }}>
              {importedCount.toLocaleString()} trade{importedCount !== 1 ? "s" : ""}
            </span>{" "}
            imported successfully.
            {duplicatesCount > 0 && (
              <> {duplicatesCount.toLocaleString()} duplicate{duplicatesCount !== 1 ? "s" : ""} skipped.</>
            )}
          </p>

          <Link
            href="/journal"
            style={{
              display: "block", width: "100%", height: 44, lineHeight: "44px",
              backgroundColor: "#0D2420", border: "1px solid #50E3B8",
              borderRadius: 8, color: "#50E3B8",
              fontSize: 14, fontWeight: 500, textDecoration: "none",
              textAlign: "center", marginBottom: 12,
              boxSizing: "border-box",
            }}
          >
            View in journal
          </Link>

          <button
            type="button"
            onClick={reset}
            style={{
              fontSize: 12, color: "#4B6080", background: "none",
              border: "none", cursor: "pointer", fontFamily: "inherit",
              textDecoration: "underline",
            }}
          >
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}
