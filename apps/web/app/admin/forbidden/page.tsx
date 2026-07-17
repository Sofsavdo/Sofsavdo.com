import Link from "next/link";
import { Lock } from "lucide-react";

export default function AdminForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-pad-mobile text-center">
      <Lock className="size-10 text-error" />
      <h1 className="font-heading text-xl font-bold text-text-primary">Ruxsat yo&apos;q</h1>
      <p className="max-w-sm font-body text-sm text-text-secondary">
        Bu bo&apos;lim faqat yuqoriroq ruxsat darajasiga ega adminlar uchun ochiq. Kerak bo&apos;lsa Super Admin bilan
        bog&apos;laning.
      </p>
      <Link href="/admin/dashboard" className="font-body text-sm text-accent underline">
        Dashboardga qaytish
      </Link>
    </div>
  );
}
