import Topbar from "./topbar";
import Sidebar from "./sidebar";
import MindEngineStrip from "./MindEngineStrip";
import BottomTabBar from "./BottomTabBar";
import { NavLockProvider } from "./NavLockContext";
import { CurrencyProvider } from "./CurrencyContext";
import type { User } from "@/db/schema/users";

interface ShellProps {
  children: React.ReactNode;
  user: User | null;
}

export default function Shell({ children, user }: ShellProps) {
  // Read admin path server-side — never expose via a public env var.
  // Only passed to Topbar when the user is an admin to avoid the cost of
  // a prop that can never be used.
  const adminPath =
    user?.role === "admin"
      ? `/${process.env.ADMIN_PANEL_PATH ?? ""}`
      : undefined;

  return (
    <NavLockProvider>
      <CurrencyProvider initialCurrency={user?.preferredCurrency ?? "USD"}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
          backgroundColor: "var(--color-bg)",
        }}
      >
        <Topbar user={user} adminPath={adminPath} />

        <div
          style={{
            display: "flex",
            flex: 1,
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          {/* Sidebar — hidden below md via its own className */}
          <Sidebar user={user} />

          {/* Main content — full width on mobile, scrolls independently */}
          <main
            className="flex-1 overflow-y-auto px-4 pb-20 md:px-6 md:pb-6"
            style={{ backgroundColor: "var(--color-bg)" }}
          >
            {children}
          </main>
        </div>

        {/* MindEngineStrip — hidden below md via its own className */}
        <MindEngineStrip />

        {/* Bottom tab bar — visible only below md */}
        <BottomTabBar />
      </div>
      </CurrencyProvider>
    </NavLockProvider>
  );
}
