import { redirect, notFound } from "next/navigation";
import { requireAdmin, NotAuthenticatedError, NotAuthorizedError } from "@/lib/admin-auth";
import AdminShell from "@/components/layout/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Defense in depth — independent of proxy.ts path masking. Runs on every
  // request to this layout regardless of how the request got here.
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof NotAuthenticatedError) redirect("/login");
    if (err instanceof NotAuthorizedError) notFound();
    throw err;
  }

  return <AdminShell admin={admin}>{children}</AdminShell>;
}
