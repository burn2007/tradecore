"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import TradeRow, { type TradeRowData } from "@/components/trades/TradeRow";
import { pushToast } from "@/components/ui/Toast";

interface UserRow {
  id: string;
  email: string;
  displayName: string | null;
  tier: string;
  role: string;
  preferredCurrency: string;
  createdAt: string;
  deletedAt: string | null;
  deletedByEmail: string | null;
}

interface StatsRow {
  totalTrades: number;
  disciplineScore: string | null;
}

export interface UserDetailData {
  user: UserRow;
  stats: StatsRow | null;
  recentTrades: TradeRowData[];
}

const TIER_COLOR: Record<string, string> = { free: "#4B6080", pro: "#50E3B8", premium: "#E2B96F" };
const TIER_BG:    Record<string, string> = { free: "#0A0F1A", pro: "#0D2420", premium: "#1A1A08" };

const INPUT_STYLE: React.CSSProperties = {
  backgroundColor: "#0A0F1A",
  border: "1px solid #1A2640",
  borderRadius: 8,
  color: "#C9C2AE",
  height: 38,
  padding: "0 12px",
  width: "100%",
  fontSize: 12,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "8px 0", borderTop: "1px solid #0F1A2A",
    }}>
      <span style={{ fontSize: 11, color: "#6B8AAA" }}>{label}</span>
      <span style={{ fontSize: 12, color: "#C9C2AE", textTransform: "capitalize" }}>{value}</span>
    </div>
  );
}

export default function UserDetailClient({
  userId,
  initialData,
  adminId,
}: {
  userId: string;
  initialData: UserDetailData;
  adminId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const base = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
  const queryClient = useQueryClient();

  const [data, setData] = useState(initialData);
  const { user, stats, recentTrades } = data;

  // ── Tier change ──────────────────────────────────────────────────────────────
  const tierMutation = useMutation<unknown, Error, string, { previous: UserDetailData }>({
    mutationFn: async (tier: string) => {
      const res = await fetch(`/api/admin/users/${userId}/tier`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) throw new Error("Failed to update tier");
      return res.json();
    },
    onMutate: (tier) => {
      const previous = data;
      setData((d) => ({ ...d, user: { ...d.user, tier } }));
      return { previous };
    },
    onError: (_err, _tier, context) => {
      if (context) setData(context.previous);
      pushToast({ label: "Could not update tier. Please try again.", accent: "#F07C7C" });
    },
    onSuccess: (_result, tier) => {
      pushToast({ label: `Tier updated to ${tier}.`, accent: "#50E3B8" });
    },
  });

  // ── Send password reset ──────────────────────────────────────────────────────
  const resetMutation = useMutation<unknown, Error>({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/send-password-reset`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      pushToast({ label: `Password reset email sent to ${user.email}.`, accent: "#50E3B8" });
    },
    onError: () => {
      pushToast({ label: "Could not send reset email. Please try again.", accent: "#F07C7C" });
    },
  });

  // ── Set temporary password ───────────────────────────────────────────────────
  const [showTempPw, setShowTempPw] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const pw1Ref = useRef<HTMLInputElement>(null);

  const tempPwMutation = useMutation<unknown, Error>({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/set-temporary-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temporaryPassword: pw1 }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      pushToast({ label: "Temporary password set.", accent: "#50E3B8" });
      setShowTempPw(false);
      setPw1("");
      setPw2("");
    },
    onError: () => {
      pushToast({ label: "Could not set password. Please try again.", accent: "#F07C7C" });
    },
  });

  const pwMatch = pw1.length >= 8 && pw1 === pw2;

  // ── Soft delete (Move to reserve) ────────────────────────────────────────────
  const [showDelete, setShowDelete] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const deleteConfirmed = confirmEmail === user.email;

  const deleteMutation = useMutation<unknown, { message: string } & Error>({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail }),
      });
      const json = await res.json();
      if (!res.ok) throw Object.assign(new Error(json.error ?? "Failed"), { message: json.error ?? "Failed" });
      return json;
    },
    onSuccess: () => {
      pushToast({ label: "Account moved to reserve.", accent: "#E2B96F" });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      router.push(`${base}/users`);
    },
    onError: (err) => {
      pushToast({ label: err.message ?? "Move to reserve failed. Please try again.", accent: "#F07C7C" });
    },
  });

  // ── Restore account ──────────────────────────────────────────────────────────
  const restoreMutation = useMutation<unknown, Error>({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to restore");
      return res.json();
    },
    onSuccess: () => {
      pushToast({ label: "Account restored.", accent: "#50E3B8" });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      router.push(`${base}/users/${userId}`);
      // Refresh the local state to show active UI
      setData((d) => ({ ...d, user: { ...d.user, deletedAt: null, deletedByEmail: null } }));
    },
    onError: () => {
      pushToast({ label: "Failed to restore account.", accent: "#F07C7C" });
    },
  });

  // ── Permanent delete ─────────────────────────────────────────────────────────
  const [showPermDelete, setShowPermDelete] = useState(false);
  const [permConfirmEmail, setPermConfirmEmail] = useState("");
  const permDeleteConfirmed = permConfirmEmail === user.email;

  const permDeleteMutation = useMutation<unknown, { message: string } & Error>({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/permanent-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: permConfirmEmail }),
      });
      const json = await res.json();
      if (!res.ok) throw Object.assign(new Error(json.error ?? "Failed"), { message: json.error ?? "Failed" });
      return json;
    },
    onSuccess: () => {
      pushToast({ label: "Account permanently deleted.", accent: "#F07C7C" });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      router.push(`${base}/reserve`);
    },
    onError: (err) => {
      pushToast({ label: err.message ?? "Deletion failed. Please try again.", accent: "#F07C7C" });
    },
  });

  const joined = new Date(user.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
  const discipline = stats?.disciplineScore != null ? Math.round(parseFloat(stats.disciplineScore)) : "—";
  const totalTrades = stats?.totalTrades ?? "—";

  const isSelf      = user.id === adminId;
  const isAdminRole = user.role === "admin";
  const cannotDelete = isSelf || isAdminRole;
  const isDeleted   = user.deletedAt != null;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => router.push(`${base}/${isDeleted ? "reserve" : "users"}`)}
          style={{
            background: "none", border: "none", padding: 0,
            fontSize: 11, color: "#6B8AAA", cursor: "pointer",
            fontFamily: "inherit", textDecoration: "none",
          }}
        >
          ← {isDeleted ? "Reserve" : "Users"}
        </button>
        <p style={{ fontSize: 16, fontWeight: 500, color: "#C9C2AE", margin: 0 }}>
          {user.displayName || user.email}
        </p>
        {isDeleted && (
          <span style={{
            fontSize: 10, fontWeight: 500, padding: "3px 8px", borderRadius: 5,
            backgroundColor: "#2E1A1A", color: "#F07C7C", border: "1px solid #6A2828",
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            In Reserve
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* ── Left column — profile ── */}
        <div style={{ backgroundColor: "#111C2E", border: "1px solid #1A2640", borderRadius: 11, padding: "20px 16px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 4 }}>
            <Avatar displayName={user.displayName} email={user.email} size={52} />
            <p style={{ fontSize: 13, fontWeight: 500, color: "#C9C2AE", margin: "10px 0 2px" }}>
              {user.displayName || user.email}
            </p>
            <p style={{ fontSize: 10, color: "#4B6080", margin: 0 }}>{user.email}</p>
          </div>

          <div style={{ marginTop: 12 }}>
            <MetaRow label="Tier" value={user.tier} />
            <MetaRow label="Role" value={user.role} />
            <MetaRow label="Joined" value={joined} />
            <MetaRow label="Preferred currency" value={user.preferredCurrency} />
            <MetaRow label="Total trades" value={totalTrades} />
            <MetaRow label="Discipline score" value={discipline} />
          </div>

          <p style={{ fontSize: 10, color: "#2E4060", margin: "14px 0 10px" }}>
            Changing this saves to the audit log.
          </p>

          <div style={{ display: "flex", gap: 6 }}>
            {(["free", "pro", "premium"] as const).map((t) => {
              const selected = user.tier === t;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={tierMutation.isPending || isDeleted}
                  onClick={() => { if (!selected && !isDeleted) tierMutation.mutate(t); }}
                  style={{
                    flex: 1, height: 40, borderRadius: 8, fontSize: 12,
                    fontWeight: selected ? 500 : 400, textTransform: "capitalize",
                    cursor: selected || tierMutation.isPending || isDeleted ? "default" : "pointer",
                    fontFamily: "inherit",
                    backgroundColor: selected ? TIER_BG[t] : "#0A0F1A",
                    border: `1px solid ${selected ? TIER_COLOR[t] : "#1A2640"}`,
                    color: selected ? TIER_COLOR[t] : "#4B6080",
                    opacity: (tierMutation.isPending && !selected) || isDeleted ? 0.6 : 1,
                    transition: "all 0.15s ease",
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right column — recent trades ── */}
        <div style={{ backgroundColor: "#111C2E", border: "1px solid #1A2640", borderRadius: 11, padding: "14px 16px" }}>
          <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "#2E4060", margin: "0 0 10px" }}>
            Recent trades
          </p>
          {recentTrades.length === 0 ? (
            <p style={{ fontSize: 12, color: "#4B6080", margin: 0 }}>No trades logged yet.</p>
          ) : (
            recentTrades.slice(0, 5).map((t) => <TradeRow key={t.id} trade={t} readOnly />)
          )}
        </div>
      </div>

      {/* ── Account actions ─────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: "#111C2E", border: "1px solid #1A2640",
        borderRadius: 11, padding: "16px", marginTop: 16,
      }}>
        <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "#2E4060", margin: "0 0 14px" }}>
          Account actions
        </p>

        {isDeleted ? (
          <p style={{ fontSize: 11, color: "#6B8AAA", margin: 0 }}>
            Account actions are unavailable while this account is in the reserve.
          </p>
        ) : (
          <>
            <button
              type="button"
              disabled={resetMutation.isPending}
              onClick={() => resetMutation.mutate()}
              style={{
                height: 38, width: "100%", borderRadius: 8,
                backgroundColor: "#111C2E", border: "1px solid #1A2640",
                color: "#6B8AAA", fontSize: 12, fontWeight: 400,
                cursor: resetMutation.isPending ? "default" : "pointer",
                fontFamily: "inherit",
                opacity: resetMutation.isPending ? 0.6 : 1,
                transition: "opacity 0.15s ease",
              }}
            >
              {resetMutation.isPending ? "Sending…" : "Send password reset email"}
            </button>

            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                onClick={() => {
                  setShowTempPw((v) => !v);
                  if (!showTempPw) setTimeout(() => pw1Ref.current?.focus(), 50);
                }}
                style={{
                  background: "none", border: "none", padding: 0,
                  fontSize: 10, color: "#4B6080", textDecoration: "underline",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {showTempPw ? "Cancel" : "Set a temporary password instead"}
              </button>

              {showTempPw && (
                <div style={{ marginTop: 10 }}>
                  <p style={{ fontSize: 11, color: "#4B6080", margin: "0 0 10px" }}>
                    Only use this if the user cannot access their email. They will not be notified.
                  </p>
                  <input
                    ref={pw1Ref}
                    type="password"
                    placeholder="New password (min 8 chars)"
                    value={pw1}
                    onChange={(e) => setPw1(e.target.value)}
                    style={{ ...INPUT_STYLE, marginBottom: 8 }}
                  />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    style={INPUT_STYLE}
                  />
                  {pw2.length > 0 && !pwMatch && (
                    <p style={{ fontSize: 10, color: "#F07C7C", margin: "4px 0 0" }}>
                      {pw1.length < 8 ? "Minimum 8 characters." : "Passwords do not match."}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={!pwMatch || tempPwMutation.isPending}
                    onClick={() => tempPwMutation.mutate()}
                    style={{
                      marginTop: 10, height: 36, width: "100%", borderRadius: 8,
                      backgroundColor: "transparent",
                      border: "1px solid #6A2828",
                      color: pwMatch ? "#F07C7C" : "#4B3030",
                      fontSize: 12, fontFamily: "inherit",
                      cursor: pwMatch && !tempPwMutation.isPending ? "pointer" : "default",
                      opacity: tempPwMutation.isPending ? 0.6 : 1,
                      transition: "all 0.15s ease",
                    }}
                  >
                    {tempPwMutation.isPending ? "Setting…" : "Set password"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Danger zone ─────────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: "#111C2E", border: "1px solid #6A2828",
        borderRadius: 11, padding: "16px", marginTop: 16,
      }}>
        <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#F07C7C", margin: "0 0 8px" }}>
          Danger zone
        </p>

        {cannotDelete ? (
          <>
            <p style={{ fontSize: 11, color: "#6B8AAA", margin: "0 0 14px" }}>
              Permanently delete this account and all of their data. This cannot be undone.
            </p>
            <p style={{ fontSize: 11, color: "#2E4060", margin: 0 }}>
              Admin accounts cannot be deleted through this panel.
            </p>
          </>
        ) : isDeleted ? (
          // ── Reserve state (already soft-deleted) ──
          <>
            <p style={{ fontSize: 11, color: "#C9C2AE", margin: "0 0 14px" }}>
              This account was moved to the reserve on {new Date(user.deletedAt!).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} by {user.deletedByEmail || "unknown"}.
            </p>

            {!showPermDelete ? (
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  type="button"
                  disabled={restoreMutation.isPending}
                  onClick={() => restoreMutation.mutate()}
                  style={{
                    flex: 1, height: 36, borderRadius: 8,
                    backgroundColor: "transparent", border: "1px solid #50E3B8",
                    color: "#50E3B8", fontSize: 12, fontFamily: "inherit",
                    cursor: restoreMutation.isPending ? "default" : "pointer",
                    opacity: restoreMutation.isPending ? 0.6 : 1,
                    transition: "opacity 0.15s ease",
                  }}
                >
                  {restoreMutation.isPending ? "Restoring…" : "Restore account"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPermDelete(true)}
                  style={{
                    flex: 1, height: 36, borderRadius: 8,
                    backgroundColor: "transparent", border: "1px solid #F07C7C",
                    color: "#F07C7C", fontSize: 12, fontFamily: "inherit", fontWeight: 500,
                    cursor: "pointer", transition: "opacity 0.15s ease",
                  }}
                >
                  Permanently delete
                </button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 11, color: "#F07C7C", margin: "0 0 10px", fontWeight: 500 }}>
                  This cannot be undone. All trades, rules, and history for this account will be permanently erased.
                </p>
                <p style={{ fontSize: 10, color: "#4B6080", margin: "0 0 6px" }}>
                  Type{" "}
                  <span style={{ color: "#8BA8C4", fontWeight: 500 }}>{user.email}</span>
                  {" "}to confirm
                </p>
                <input
                  type="text"
                  placeholder={user.email}
                  value={permConfirmEmail}
                  onChange={(e) => setPermConfirmEmail(e.target.value)}
                  autoComplete="off"
                  style={{ ...INPUT_STYLE, borderColor: "#6A2828" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    disabled={!permDeleteConfirmed || permDeleteMutation.isPending}
                    onClick={() => permDeleteMutation.mutate()}
                    style={{
                      flex: 1, height: 36, borderRadius: 8,
                      backgroundColor: permDeleteConfirmed ? "#2E1A1A" : "transparent",
                      border: "1px solid #F07C7C",
                      color: permDeleteConfirmed ? "#F07C7C" : "#6A2828",
                      fontSize: 12, fontFamily: "inherit", fontWeight: 500,
                      cursor: permDeleteConfirmed && !permDeleteMutation.isPending ? "pointer" : "default",
                      opacity: permDeleteMutation.isPending ? 0.6 : 1,
                      transition: "all 0.15s ease",
                    }}
                  >
                    {permDeleteMutation.isPending ? "Deleting…" : "Confirm permanent deletion"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowPermDelete(false); setPermConfirmEmail(""); }}
                    style={{
                      height: 36, paddingInline: 14, borderRadius: 8,
                      backgroundColor: "#111C2E", border: "1px solid #1A2640",
                      color: "#6B8AAA", fontSize: 12, fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          // ── Active state (not deleted yet) ──
          <>
            <p style={{ fontSize: 11, color: "#6B8AAA", margin: "0 0 14px" }}>
              Moving an account to the reserve suspends access. It can be restored later.
            </p>

            {!showDelete ? (
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                style={{
                  height: 36, paddingInline: 16, borderRadius: 8,
                  backgroundColor: "transparent", border: "1px solid #6A2828",
                  color: "#F07C7C", fontSize: 12, fontFamily: "inherit",
                  cursor: "pointer", transition: "opacity 0.15s ease",
                }}
              >
                Move to reserve
              </button>
            ) : (
              <div>
                <p style={{ fontSize: 10, color: "#4B6080", margin: "0 0 6px" }}>
                  Type{" "}
                  <span style={{ color: "#8BA8C4", fontWeight: 500 }}>{user.email}</span>
                  {" "}to confirm — this moves the account to the reserve. It will not be permanently deleted yet.
                </p>
                <input
                  type="text"
                  placeholder={user.email}
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  autoComplete="off"
                  style={INPUT_STYLE}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    disabled={!deleteConfirmed || deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate()}
                    style={{
                      flex: 1, height: 36, borderRadius: 8,
                      backgroundColor: "transparent",
                      border: "1px solid #6A2828",
                      color: deleteConfirmed ? "#F07C7C" : "#4B3030",
                      fontSize: 12, fontFamily: "inherit",
                      cursor: deleteConfirmed && !deleteMutation.isPending ? "pointer" : "default",
                      opacity: deleteMutation.isPending ? 0.6 : 1,
                      transition: "all 0.15s ease",
                    }}
                  >
                    {deleteMutation.isPending ? "Moving…" : "Move to reserve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDelete(false); setConfirmEmail(""); }}
                    style={{
                      height: 36, paddingInline: 14, borderRadius: 8,
                      backgroundColor: "#111C2E", border: "1px solid #1A2640",
                      color: "#6B8AAA", fontSize: 12, fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
