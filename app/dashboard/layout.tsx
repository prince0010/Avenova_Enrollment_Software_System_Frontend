import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { AppSidebar } from "@/components/app-sidebar";
import { UserMenu } from "@/components/user-menu";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard requireAuth={true}>
      <div className="flex min-h-screen">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Same soft teal wash as the sidebar clock — keeps the two
              "info" chrome bars (clock, name/logout) visually paired. */}
          <header className="flex h-14 items-center justify-end border-b bg-[#117b8e]/[0.06] px-6">
            <UserMenu />
          </header>
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
