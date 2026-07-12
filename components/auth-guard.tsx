"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface AuthGuardProps {
  requireAuth: boolean;
  children: ReactNode;
}

export function AuthGuard({ requireAuth, children }: AuthGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (requireAuth && !user) {
      router.replace("/login");
    } else if (!requireAuth && user) {
      router.replace("/dashboard");
    }
  }, [isLoading, requireAuth, user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const redirecting = (requireAuth && !user) || (!requireAuth && !!user);
  if (redirecting) return null;

  return <>{children}</>;
}
