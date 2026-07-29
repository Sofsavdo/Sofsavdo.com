"use client";

import { Badge, Card, CardHeader, CardTitle, Skeleton } from "@sofsavdo/ui";
import { useSession } from "@/services/session";
import { applicationStatusMeta } from "@/lib/status";

const PLATFORM_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  TELEGRAM: "Telegram",
};

function maskCardNumber(digits: string): string {
  const last4 = digits.replace(/\s/g, "").slice(-4);
  return `•••• ${last4}`;
}

export default function CreatorProfilePage() {
  const { user, isLoading } = useSession();

  if (isLoading || !user) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const { application } = user;
  const data = application.data;
  const statusMeta = applicationStatusMeta[application.status];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Profil</h1>
        <p className="font-body text-sm text-text-secondary">Ariza ma&apos;lumotlaringiz — tahrirlash uchun support bilan bog&apos;laning.</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Shaxsiy ma&apos;lumot</CardTitle>
          {statusMeta ? <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge> : null}
        </CardHeader>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="font-body text-xs text-text-muted">Ism</dt>
            <dd className="font-body text-sm text-text-primary">{user.displayName}</dd>
          </div>
          <div>
            <dt className="font-body text-xs text-text-muted">Email</dt>
            <dd className="break-words font-body text-sm text-text-primary">{user.email}</dd>
          </div>
          <div>
            <dt className="font-body text-xs text-text-muted">Telefon</dt>
            <dd className="font-body text-sm text-text-primary">{data.phone || "—"}</dd>
          </div>
          <div>
            <dt className="font-body text-xs text-text-muted">Shahar</dt>
            <dd className="font-body text-sm text-text-primary">{data.city || "—"}</dd>
          </div>
          {data.bio ? (
            <div className="sm:col-span-2">
              <dt className="font-body text-xs text-text-muted">O&apos;zi haqida</dt>
              <dd className="font-body text-sm text-text-primary">{data.bio}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kontent yo&apos;nalishlari</CardTitle>
        </CardHeader>
        {data.contentNiches && data.contentNiches.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {data.contentNiches.map((niche) => (
              <Badge key={niche} tone="neutral">
                {niche}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="font-body text-sm text-text-muted">Kiritilmagan.</p>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ijtimoiy tarmoqlar</CardTitle>
        </CardHeader>
        {data.socialAccounts && data.socialAccounts.length > 0 ? (
          <ul className="divide-y divide-border">
            {data.socialAccounts.map((account) => (
              <li key={account.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="font-body text-sm font-medium text-text-primary">{PLATFORM_LABELS[account.platform] ?? account.platform}</p>
                  <p className="truncate font-body text-xs text-text-muted">{account.handle}</p>
                </div>
                <span className="shrink-0 font-numeric text-sm tabular-nums text-text-secondary">
                  {account.followerCount.toLocaleString("uz-UZ")} obunachi
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-body text-sm text-text-muted">Ijtimoiy tarmoq hisobi qo&apos;shilmagan.</p>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>To&apos;lov ma&apos;lumoti</CardTitle>
        </CardHeader>
        {data.payoutMethodType === "CARD" && data.payoutCardNumber ? (
          <p className="font-body text-sm text-text-primary">
            Bank kartasi — {maskCardNumber(data.payoutCardNumber)}
            {data.payoutCardHolder ? ` (${data.payoutCardHolder})` : ""}
          </p>
        ) : data.payoutMethodType === "BANK_ACCOUNT" && data.payoutBankName ? (
          <p className="font-body text-sm text-text-primary">
            {data.payoutBankName} — {data.payoutBankAccount ? maskCardNumber(data.payoutBankAccount) : "—"}
          </p>
        ) : (
          <p className="font-body text-sm text-text-muted">To&apos;lov usuli kiritilmagan.</p>
        )}
      </Card>
    </div>
  );
}
