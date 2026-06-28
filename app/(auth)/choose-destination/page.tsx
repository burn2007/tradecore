import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin, NotAuthenticatedError } from "@/lib/admin-auth";
import { adminDb as db } from "@/lib/db";
import { users } from "@/db/schema/users";
import { eq } from "drizzle-orm";
import ChooseDestinationClient from "@/components/auth/ChooseDestinationClient";

export const metadata: Metadata = { title: "Choose destination — TradeCore" };

export default async function ChooseDestinationPage() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof NotAuthenticatedError) redirect("/login");
    // NotAuthorizedError — regular user somehow reached this page
    redirect("/dashboard");
  }

  const adminPath = `/${process.env.ADMIN_PANEL_PATH ?? ""}`;

  const [row] = await db
    .select({ displayName: users.displayName, lastChosenDestination: users.lastChosenDestination })
    .from(users)
    .where(eq(users.id, admin.id))
    .limit(1);

  const firstName = row?.displayName?.split(" ")[0] ?? admin.email.split("@")[0];

  return (
    <ChooseDestinationClient
      firstName={firstName}
      adminPath={adminPath}
      lastChosen={row?.lastChosenDestination ?? null}
    />
  );
}
