import { notFound } from "next/navigation";
import { headers, cookies } from "next/headers";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import UserDetailClient, { type UserDetailData } from "@/components/admin/UserDetailClient";

export const metadata: Metadata = { title: "User — Admin — TradeCore" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { id } = await params;

  // requireAdmin is already called by the layout, but we call it here too so
  // we can pass adminId down to the client for the self-delete guard UI.
  const admin = await requireAdmin();

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  const cookieHeader = (await cookies()).toString();

  const res = await fetch(`${protocol}://${host}/api/admin/users/${id}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (res.status === 404) notFound();
  if (!res.ok) throw new Error("Failed to load user");

  const data: UserDetailData = await res.json();

  return <UserDetailClient userId={id} initialData={data} adminId={admin.id} />;
}
