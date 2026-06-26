"use client";

import { useState, useRef } from "react";
import type { Rule } from "@/db/schema/rules";

/* ── Shared style constants ── */
const CARD: React.CSSProperties = {
  backgroundColor: "#111C2E",
  border: "1px solid #1A2640",
  borderRadius: 11,
  marginBottom: 8,
};
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
const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#2E4060",
  fontWeight: 500,
  marginBottom: 6,
};

/* ── Starter templates ── */
const RULE_TEMPLATES = [
  "Never trade during red-folder news",
  "Max 2% risk per trade",
  "Only enter at London open",
  "Wait for confirmation candle to close",
  "No revenge trading after a loss",
  "Always set stop loss before entry",
  "No trading after 3 consecutive losses",
  "Follow the higher timeframe trend only",
];

interface Props {
  initialRules: Rule[];
}

export default function RulesClient({ initialRules }: Props) {
  const [rulesList, setRulesList] = useState<Rule[]>(initialRules);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  /* ── Add rule ── */
  async function handleAdd() {
    const title = newTitle.trim();
    if (!title) { setError("Rule title is required"); return; }
    setAdding(true); setError("");
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: newDesc.trim() || undefined }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to add rule"); return; }
      const created: Rule = await res.json();
      setRulesList((prev) => [...prev, created]);
      setNewTitle(""); setNewDesc(""); setShowAdd(false);
    } catch { setError("Network error"); }
    finally { setAdding(false); }
  }

  /* ── Start edit ── */
  function startEdit(rule: Rule) {
    setEditingId(rule.id);
    setEditTitle(rule.title);
    setEditDesc(rule.description ?? "");
    setError("");
  }

  /* ── Save edit ── */
  async function handleEdit(id: string) {
    const title = editTitle.trim();
    if (!title) { setError("Rule title is required"); return; }
    setError("");
    try {
      const res = await fetch(`/api/rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: editDesc.trim() || undefined }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to update"); return; }
      const updated: Rule = await res.json();
      setRulesList((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setEditingId(null);
    } catch { setError("Network error"); }
  }

  /* ── Toggle active ── */
  async function handleToggleActive(rule: Rule) {
    const nextVal = !rule.isActive;
    // Optimistic update
    setRulesList((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, isActive: nextVal } : r))
    );
    try {
      const res = await fetch(`/api/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextVal }),
      });
      if (!res.ok) {
        // Revert
        setRulesList((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, isActive: rule.isActive } : r))
        );
      }
    } catch {
      setRulesList((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, isActive: rule.isActive } : r))
      );
    }
  }

  /* ── Delete ── */
  async function handleDelete(id: string) {
    setDeletingId(id); setError("");
    try {
      const res = await fetch(`/api/rules/${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to delete"); return; }
      setRulesList((prev) => prev.filter((r) => r.id !== id));
      setConfirmDeleteId(null);
    } catch { setError("Network error"); }
    finally { setDeletingId(null); }
  }

  const activeRules   = rulesList.filter((r) => r.isActive);
  const inactiveRules = rulesList.filter((r) => !r.isActive);

  return (
    <div>
      {/* ── Header stats ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {[
          { label: "Total rules", value: rulesList.length, color: "#8BA8C4" },
          { label: "Active", value: activeRules.length, color: "#50E3B8" },
          { label: "Paused", value: inactiveRules.length, color: "#4B6080" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              backgroundColor: "#111C2E",
              border: "1px solid #1A2640",
              borderRadius: 9,
              padding: "12px 14px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 22, fontWeight: 500, color: s.color, margin: "0 0 2px" }}>
              {s.value}
            </p>
            <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "#2E4060", margin: 0 }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Empty state ── */}
      {rulesList.length === 0 && !showAdd && (
        <div
          style={{
            ...CARD,
            padding: "32px 20px",
            textAlign: "center",
            borderStyle: "dashed",
          }}
        >
          <svg
            viewBox="0 0 48 48"
            width="40"
            fill="none"
            stroke="#2E4060"
            strokeWidth="1.5"
            style={{ marginBottom: 12 }}
          >
            <rect x="8" y="6" width="32" height="36" rx="3" />
            <path strokeLinecap="round" d="M16 16h16M16 24h16M16 32h10" />
            <circle cx="38" cy="38" r="8" fill="#0A0F1A" stroke="#E2B96F" />
            <path stroke="#E2B96F" strokeLinecap="round" d="M38 34v4l2 2" />
          </svg>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#C9C2AE", margin: "0 0 6px" }}>
            No trading rules yet
          </p>
          <p style={{ fontSize: 12, color: "#4B6080", margin: "0 0 16px", lineHeight: 1.6 }}>
            Rules appear after every trade so you can track your discipline.
          </p>
          <button
            type="button"
            onClick={() => { setShowAdd(true); setTimeout(() => titleRef.current?.focus(), 50); }}
            style={{
              padding: "8px 20px",
              backgroundColor: "#0F1E30",
              border: "1px solid #E2B96F",
              borderRadius: 8,
              color: "#E2B96F",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            + Add your first rule
          </button>
        </div>
      )}

      {/* ── Active rules list ── */}
      {activeRules.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p
            style={{
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#2E4060",
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            Active rules ({activeRules.length})
          </p>
          {activeRules.map((rule, idx) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              index={idx + 1}
              isEditing={editingId === rule.id}
              editTitle={editTitle}
              editDesc={editDesc}
              confirmDelete={confirmDeleteId === rule.id}
              deleting={deletingId === rule.id}
              onStartEdit={() => startEdit(rule)}
              onCancelEdit={() => { setEditingId(null); setError(""); }}
              onEditTitle={setEditTitle}
              onEditDesc={setEditDesc}
              onSaveEdit={() => handleEdit(rule.id)}
              onToggleActive={() => handleToggleActive(rule)}
              onRequestDelete={() => setConfirmDeleteId(rule.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
              onConfirmDelete={() => handleDelete(rule.id)}
            />
          ))}
        </div>
      )}

      {/* ── Paused rules list ── */}
      {inactiveRules.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p
            style={{
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#2E4060",
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            Paused rules ({inactiveRules.length})
          </p>
          {inactiveRules.map((rule, idx) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              index={idx + 1}
              isEditing={editingId === rule.id}
              editTitle={editTitle}
              editDesc={editDesc}
              confirmDelete={confirmDeleteId === rule.id}
              deleting={deletingId === rule.id}
              onStartEdit={() => startEdit(rule)}
              onCancelEdit={() => { setEditingId(null); setError(""); }}
              onEditTitle={setEditTitle}
              onEditDesc={setEditDesc}
              onSaveEdit={() => handleEdit(rule.id)}
              onToggleActive={() => handleToggleActive(rule)}
              onRequestDelete={() => setConfirmDeleteId(rule.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
              onConfirmDelete={() => handleDelete(rule.id)}
            />
          ))}
        </div>
      )}

      {/* ── Add rule form ── */}
      {showAdd && (
        <div
          style={{
            ...CARD,
            padding: "18px 20px",
            borderColor: "#E2B96F",
            borderStyle: "solid",
            marginBottom: 12,
          }}
        >
          <p
            style={{
              fontSize: 11,
              color: "#E2B96F",
              fontWeight: 500,
              margin: "0 0 14px",
            }}
          >
            New rule
          </p>
          <div style={{ marginBottom: 10 }}>
            <label style={LABEL}>Rule title *</label>
            <input
              ref={titleRef}
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="e.g. Never trade during red news"
              style={INPUT}
              maxLength={200}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ ...LABEL }}>
              Description{" "}
              <span style={{ color: "#2E4060", textTransform: "none", letterSpacing: 0 }}>
                (optional)
              </span>
            </label>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              placeholder="More detail about this rule…"
              style={{
                ...INPUT,
                height: "auto",
                padding: "8px 12px",
                resize: "vertical",
                lineHeight: 1.55,
              }}
              maxLength={500}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleAdd}
              disabled={adding}
              style={{
                flex: 1,
                height: 38,
                backgroundColor: "#0F1E30",
                border: "1px solid #E2B96F",
                borderRadius: 8,
                color: "#E2B96F",
                fontSize: 12,
                fontWeight: 500,
                cursor: adding ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: adding ? 0.7 : 1,
              }}
            >
              {adding ? "Adding…" : "Add rule"}
            </button>
            <button
              type="button"
              onClick={() => { setShowAdd(false); setNewTitle(""); setNewDesc(""); setError(""); }}
              style={{
                height: 38,
                padding: "0 14px",
                backgroundColor: "transparent",
                border: "1px solid #1A2640",
                borderRadius: 8,
                color: "#4B6080",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Templates ── */}
      {!showAdd && rulesList.length < 10 && (
        <div
          style={{
            backgroundColor: "#111C2E",
            border: "1px solid #1A2640",
            borderRadius: 11,
            padding: "16px 20px",
            marginBottom: 16,
          }}
        >
          <p
            style={{
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#2E4060",
              fontWeight: 500,
              margin: "0 0 10px",
            }}
          >
            Quick add from templates
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {RULE_TEMPLATES.filter(
              (t) => !rulesList.some((r) => r.title === t)
            ).map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => {
                  setNewTitle(template);
                  setShowAdd(true);
                  setTimeout(() => titleRef.current?.focus(), 50);
                }}
                style={{
                  padding: "4px 10px",
                  backgroundColor: "#0A0F1A",
                  border: "1px solid #1A2640",
                  borderRadius: 5,
                  fontSize: 11,
                  color: "#4B6080",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                + {template}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p
          style={{
            fontSize: 12,
            color: "#F07C7C",
            marginBottom: 10,
            padding: "8px 12px",
            backgroundColor: "#240808",
            border: "1px solid #F07C7C",
            borderRadius: 7,
          }}
        >
          {error}
        </p>
      )}

      {/* ── Add rule button ── */}
      {!showAdd && rulesList.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setShowAdd(true);
            setTimeout(() => titleRef.current?.focus(), 50);
          }}
          style={{
            width: "100%",
            height: 44,
            backgroundColor: "#0F1E30",
            border: "1px solid #E2B96F",
            borderRadius: 8,
            color: "#E2B96F",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          + Add rule
        </button>
      )}
    </div>
  );
}

/* ── Individual rule row component ── */
interface RuleRowProps {
  rule: Rule;
  index: number;
  isEditing: boolean;
  editTitle: string;
  editDesc: string;
  confirmDelete: boolean;
  deleting: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onEditTitle: (v: string) => void;
  onEditDesc: (v: string) => void;
  onSaveEdit: () => void;
  onToggleActive: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

function RuleRow({
  rule,
  index,
  isEditing,
  editTitle,
  editDesc,
  confirmDelete,
  deleting,
  onStartEdit,
  onCancelEdit,
  onEditTitle,
  onEditDesc,
  onSaveEdit,
  onToggleActive,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: RuleRowProps) {
  if (isEditing) {
    return (
      <div
        style={{
          ...CARD,
          padding: "16px 20px",
          borderColor: "#8BA8C4",
        }}
      >
        <div style={{ marginBottom: 10 }}>
          <label style={LABEL}>Rule title *</label>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => onEditTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSaveEdit(); if (e.key === "Escape") onCancelEdit(); }}
            style={INPUT}
            maxLength={200}
            autoFocus
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={LABEL}>Description (optional)</label>
          <textarea
            value={editDesc}
            onChange={(e) => onEditDesc(e.target.value)}
            rows={2}
            style={{
              ...INPUT,
              height: "auto",
              padding: "8px 12px",
              resize: "vertical",
              lineHeight: 1.55,
            }}
            maxLength={500}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onSaveEdit}
            style={{
              flex: 1,
              height: 36,
              backgroundColor: "#0A1A28",
              border: "1px solid #8BA8C4",
              borderRadius: 7,
              color: "#8BA8C4",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Save changes
          </button>
          <button
            type="button"
            onClick={onCancelEdit}
            style={{
              height: 36,
              padding: "0 14px",
              backgroundColor: "transparent",
              border: "1px solid #1A2640",
              borderRadius: 7,
              color: "#4B6080",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (confirmDelete) {
    return (
      <div
        style={{
          ...CARD,
          padding: "14px 20px",
          borderColor: "#F07C7C",
        }}
      >
        <p style={{ fontSize: 12, color: "#F07C7C", margin: "0 0 12px" }}>
          Delete &ldquo;{rule.title}&rdquo;? This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onConfirmDelete}
            disabled={deleting}
            style={{
              flex: 1,
              height: 36,
              backgroundColor: "#240808",
              border: "1px solid #F07C7C",
              borderRadius: 7,
              color: "#F07C7C",
              fontSize: 12,
              fontWeight: 500,
              cursor: deleting ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: deleting ? 0.7 : 1,
            }}
          >
            {deleting ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            type="button"
            onClick={onCancelDelete}
            style={{
              height: 36,
              padding: "0 14px",
              backgroundColor: "transparent",
              border: "1px solid #1A2640",
              borderRadius: 7,
              color: "#4B6080",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Keep
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...CARD,
        padding: "14px 16px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        opacity: rule.isActive ? 1 : 0.5,
        transition: "opacity 0.15s",
      }}
    >
      {/* Index bubble */}
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          backgroundColor: rule.isActive ? "#0D2420" : "#0A0F1A",
          border: `1px solid ${rule.isActive ? "#50E3B8" : "#1A2640"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 500,
          color: rule.isActive ? "#50E3B8" : "#2E4060",
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {index}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#C9C2AE",
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {rule.title}
        </p>
        {rule.description && (
          <p
            style={{
              fontSize: 11,
              color: "#4B6080",
              margin: "3px 0 0",
              lineHeight: 1.5,
            }}
          >
            {rule.description}
          </p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {/* Toggle active */}
        <button
          type="button"
          onClick={onToggleActive}
          title={rule.isActive ? "Pause rule" : "Activate rule"}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            backgroundColor: "transparent",
            border: "1px solid #1A2640",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: rule.isActive ? "#50E3B8" : "#2E4060",
          }}
        >
          {rule.isActive ? (
            /* Pause icon */
            <svg viewBox="0 0 16 16" width="12" fill="currentColor">
              <rect x="3" y="2" width="4" height="12" rx="1" />
              <rect x="9" y="2" width="4" height="12" rx="1" />
            </svg>
          ) : (
            /* Play icon */
            <svg viewBox="0 0 16 16" width="12" fill="currentColor">
              <path d="M4 2l10 6-10 6V2z" />
            </svg>
          )}
        </button>

        {/* Edit */}
        <button
          type="button"
          onClick={onStartEdit}
          title="Edit rule"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            backgroundColor: "transparent",
            border: "1px solid #1A2640",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#4B6080",
          }}
        >
          <svg viewBox="0 0 16 16" width="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" />
          </svg>
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={onRequestDelete}
          title="Delete rule"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            backgroundColor: "transparent",
            border: "1px solid #1A2640",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#4B6080",
          }}
        >
          <svg viewBox="0 0 16 16" width="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 4h10M6 4V2h4v2M5 4l1 10h4l1-10" />
          </svg>
        </button>
      </div>
    </div>
  );
}
