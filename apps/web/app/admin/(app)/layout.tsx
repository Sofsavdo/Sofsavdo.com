import { AdminGuard } from "@/components/admin/AdminGuard";

export const dynamic = "force-dynamic";

export default function AdminAppLayout({ children }: { children: React.ReactNode }) {
  return <AdminGuard>{children}</AdminGuard>;
}
