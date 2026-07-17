"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@rosti/ui";
import { useAdminSession } from "@/services/adminSession";
import { AdminShell } from "./AdminShell";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAdminSession();

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace("/admin/login");
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-pad-mobile">
        <div className="w-full max-w-page space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
