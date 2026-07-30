import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@sofsavdo/ui";
import { BRAND } from "@sofsavdo/config/brand";

export default function BuyerSupportPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Yordam</h1>
      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>Biz bilan bog&apos;laning</CardTitle>
        </CardHeader>
        <p className="font-body text-sm text-text-secondary">Savollaringiz bo&apos;lsa, bemalol yozing.</p>
        <a href={BRAND.supportTelegramUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-body font-medium text-accent underline">
          Telegram: @{BRAND.supportTelegram}
        </a>
      </Card>
      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>Foydali havolalar</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-2 font-body text-sm">
          <Link href="/legal/terms" className="text-accent underline">
            Foydalanish shartlari
          </Link>
          <Link href="/legal/refund-policy" className="text-accent underline">
            Qaytarish siyosati
          </Link>
          <Link href="/legal/privacy" className="text-accent underline">
            Maxfiylik siyosati
          </Link>
        </div>
      </Card>
    </div>
  );
}
