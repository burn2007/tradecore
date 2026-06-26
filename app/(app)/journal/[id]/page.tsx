import type { Metadata } from "next";
import TradeDetail from "@/components/trades/TradeDetail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Trade ${id.slice(0, 8)}… — TradeCore` };
}

export default async function TradeDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <TradeDetail id={id} />;
}
