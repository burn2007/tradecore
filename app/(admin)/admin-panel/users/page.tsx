import type { Metadata } from "next";
import { Suspense } from "react";
import UsersClient from "@/components/admin/UsersClient";

export const metadata: Metadata = { title: "Users — Admin — TradeCore" };

export default function AdminUsersPage() {
  return (
    <Suspense>
      <UsersClient />
    </Suspense>
  );
}
