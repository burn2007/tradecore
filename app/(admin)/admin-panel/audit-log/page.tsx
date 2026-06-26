import type { Metadata } from "next";
import AuditLogClient from "@/components/admin/AuditLogClient";

export const metadata: Metadata = { title: "Audit log — Admin — TradeCore" };

export default function AdminAuditLogPage() {
  return <AuditLogClient />;
}
