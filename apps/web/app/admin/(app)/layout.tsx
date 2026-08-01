'use client';

import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminV2Navigation } from "@/components/simplified/admin-v2-navigation";
import { usePathname } from "next/navigation";

export const dynamic = "force-dynamic";

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isV2Route = pathname?.startsWith('/admin/v2');

  return (
    <>
      {isV2Route && <AdminV2Navigation />}
      {children}
    </>
  );
}

export default function AdminAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AdminGuard>
  );
}
