import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import AnalyticsClient from "@/components/analytics/AnalyticsClient";

export const metadata: Metadata = { title: "Analytics — TradeCore" };

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <AnalyticsClient />;
}
