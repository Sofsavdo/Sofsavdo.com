import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function AdminUnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-pad-mobile text-center">
      <ShieldAlert className="size-10 text-error" />
      <h1 className="font-heading text-xl font-bold text-text-primary">Kirish talab qilinadi</h1>
      <p className="max-w-sm font-body text-sm text-text-secondary">
        Bu sahifani ko&apos;rish uchun admin sifatida tizimga kirishingiz kerak.
      </p>
      <Link href="/admin/login" className="font-body text-sm text-accent underline">
        Kirish sahifasiga o&apos;tish
      </Link>
    </div>
  );
}
