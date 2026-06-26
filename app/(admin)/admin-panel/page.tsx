import type { Metadata } from "next";
import OverviewClient from "@/components/admin/OverviewClient";

export const metadata: Metadata = { title: "Admin — TradeCore" };

export default function AdminOverviewPage() {
  return <OverviewClient />;
}
