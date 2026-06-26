import type { Metadata } from "next";
import CreateUserClient from "@/components/admin/CreateUserClient";

export const metadata: Metadata = { title: "Create User — Admin — TradeCore" };

export default function AdminCreateUserPage() {
  return <CreateUserClient />;
}
