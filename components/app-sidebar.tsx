"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Hourglass,
  LayoutDashboard,
  Receipt,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { useNow } from "@/hooks/use-now";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Same brand colors as the login page (login button gradient, gold accent,
// AVE/NOVA lockup hues) — applied via inline `style`, not Tailwind arbitrary
// values, so these are plain CSS strings.
const BRAND_GRADIENT = "linear-gradient(135deg, #117b8e 0%, #0d6577 100%)";
const BRAND_HEADER_GRADIENT =
  "linear-gradient(110deg, #051e28 0%, #0d3c4b 60%, #117b8e 100%)";

const COLLAPSE_STORAGE_KEY = "sidebar-collapsed";

function SidebarClock({ collapsed }: { collapsed: boolean }) {
  const now = useNow();
  if (collapsed) return null;
  return (
    // A soft teal wash instead of a solid gradient block — sits comfortably
    // on the sidebar's own grayish-white background rather than fighting it,
    // while keeping the brand's teal/gold color identity.
    <div className="border-b bg-[#117b8e]/[0.06] px-4 py-4">
      <div className="flex flex-col gap-0.5 border-l-2 border-[#e1be26] pl-3">
        <p className="text-xl font-bold leading-tight text-[#0d6577] tabular-nums">
          {now
            ? now.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
              })
            : " "}
        </p>
        <p className="text-xs font-medium text-muted-foreground">
          {now
            ? now.toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : " "}
        </p>
      </div>
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
  const [collapsed, setCollapsed] = useState(false);

  // Read the saved preference after mount only — matches this app's existing
  // pattern (useNow) for values that must stay SSR/client consistent.
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const initials = user
    ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()
    : "";

  return (
    <aside
      className={cn(
        "relative flex shrink-0 flex-col border-r bg-background transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-56"
      )}
    >
      {/* Brand header — same AVENOVA lockup treatment as the login page's
          left panel (dark teal gradient, AVE in light teal, NOVA in gold). */}
      <div
        className="flex h-20 items-center gap-2.5 border-b px-3"
        style={{ background: BRAND_HEADER_GRADIENT }}
      >
        {/* Same icon treatment as the login page's brand lockup: white
            rounded-2xl box + that exact drop shadow, just sized for the
            sidebar's narrower column. */}
        <div
          className={cn(
            "flex shrink-0 rounded-2xl bg-white p-2 shadow-[0_8px_24px_rgba(3,20,28,0.35)]",
            collapsed && "mx-auto"
          )}
        >
          <Image
            src="/images/Avenova_logo.png"
            alt="Avenova"
            width={36}
            height={36}
            className="h-9 w-9"
          />
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-none">
            <div className="text-[15px] font-extrabold tracking-wide">
              <span className="text-[#7fd4e4]">AVE</span>
              <span className="text-[#e0c98f]">NOVA</span>
            </div>
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-white/70">
              Enrollment System
            </div>
          </div>
        )}
      </div>

      {/* Floating collapse toggle — pinned to the sidebar's right edge so it
          doesn't have to compete with the header content for space. */}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute top-7 -right-3 flex size-6 items-center justify-center rounded-full bg-[#117b8e] text-white shadow-md ring-2 ring-background transition-colors hover:bg-[#0d6577]"
      >
        {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
      </button>

      <SidebarClock collapsed={collapsed} />

      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                collapsed && "justify-center px-0",
                isActive
                  ? "font-medium text-white shadow-[0_4px_10px_rgba(17,123,142,0.28)]"
                  : "text-muted-foreground hover:bg-[#117b8e]/10 hover:text-[#117b8e]"
              )}
              style={isActive ? { background: BRAND_GRADIENT } : undefined}
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {user && (
        <div
          className={cn(
            "border-t px-4 py-3",
            collapsed && "flex justify-center px-0"
          )}
        >
          {collapsed ? (
            <Avatar className="size-8" title={`${user.firstName} ${user.lastName}`}>
              <AvatarFallback className="bg-[#117b8e]/10 text-xs font-semibold text-[#117b8e]">
                {initials}
              </AvatarFallback>
            </Avatar>
          ) : (
            <>
              <p className="text-sm font-medium">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-muted-foreground">{user.role}</p>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
