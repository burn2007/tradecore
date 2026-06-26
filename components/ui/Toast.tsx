"use client";

import { useCallback, useEffect, useState } from "react";

export interface ToastItem {
  id: string;
  icon?: string;
  header?: string;
  label: string;
  accent?: string;
}

type PushToast = (item: Omit<ToastItem, "id"> & { id?: string }) => void;

declare global {
  interface Window {
    __tcPushToast?: PushToast;
  }
}

/** Push a toast from anywhere — no-op if <ToastStack /> isn't mounted yet. */
export function pushToast(item: Omit<ToastItem, "id"> & { id?: string }) {
  window.__tcPushToast?.(item);
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4500);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  const accent = toast.accent ?? "#E2B96F";

  return (
    <div
      onClick={() => onDismiss(toast.id)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        backgroundColor: "#111C2E", border: `1px solid ${accent}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 8, padding: "10px 14px",
        cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        animation: "tc-toast-in 0.3s ease",
        minWidth: 240,
      }}
    >
      {toast.icon && <span style={{ fontSize: 18 }}>{toast.icon}</span>}
      <div>
        {toast.header && (
          <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: accent, margin: "0 0 2px" }}>
            {toast.header}
          </p>
        )}
        <p style={{ fontSize: 12, fontWeight: 500, color: "#C9C2AE", margin: 0 }}>{toast.label}</p>
      </div>
    </div>
  );
}

/** Shared toast stack — mount once per layout. Push via pushToast(). */
export function ToastStack() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    window.__tcPushToast = (item) => {
      const id = item.id ?? `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { ...item, id }]);
    };
    return () => { delete window.__tcPushToast; };
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes tc-toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{
        position: "fixed", bottom: 24, right: 20,
        display: "flex", flexDirection: "column", gap: 8,
        zIndex: 9999,
      }}>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </>
  );
}
