import type { Metadata } from "next";
import ImportClient from "@/components/trades/ImportClient";

export const metadata: Metadata = {
  title: "Import MT4/MT5 History — TradeCore",
  description: "Import your full MT4 or MT5 trading history from a CSV export in seconds.",
};

export default function ImportPage() {
  return <ImportClient />;
}
