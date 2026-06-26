import type { Metadata } from "next";
import { Suspense } from "react";
import ReserveClient from "@/components/admin/ReserveClient";

export const metadata: Metadata = { title: "Reserve — Admin — TradeCore" };

export default function AdminReservePage() {
  return (
    <Suspense>
      <ReserveClient />
    </Suspense>
  );
}
