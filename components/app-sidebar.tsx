"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, GraduationCap, Hourglass, LayoutDashboard, Receipt, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { useNow } from "@/hooks/use-now";

function SidebarClock() {
  const now = useNow();
  return (
    <div className="border-b px-4 py-4 text-center">
      <p className="text-2xl font-semibold tabular-nums">
        {now
          ? now.toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
            })
          : " "}
      </p>
      <p className="text-sm text-muted-foreground">
        {now
          ? now.toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : " "}
      </p>
    </div>
  );
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/students", label: "Students", icon: Users },
  { href: "/dashboard/pending", label: "Pending", icon: Hourglass },
  { href: "/dashboard/enrollments", label: "Enrolled", icon: GraduationCap },
  { href: "/dashboard/fees", label: "Fees", icon: Receipt },
  { href: "/dashboard/archive", label: "Archive", icon: Archive },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-background">
      <div className="flex h-14 items-center border-b px-4">
        <span className="font-heading text-sm font-semibold">
          Enrollment System
        </span>
      </div>
      <SidebarClock />
      <nav className="flex flex-col gap-1 p-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {user && (
        <div className="mt-auto border-t px-4 py-3">
          <p className="text-sm font-medium">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-muted-foreground">{user.role}</p>
        </div>
      )}
    </aside>
  );
}
