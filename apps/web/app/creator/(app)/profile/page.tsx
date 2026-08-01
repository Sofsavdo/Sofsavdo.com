"use client";

import { useState } from "react";
import { Badge, Card, CardHeader, CardTitle, Skeleton, Button, TextField, Alert } from "@sofsavdo/ui";
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
  const [isEditing, setIsEditing] = useState(false);
  const [socialLinks, setSocialLinks] = useState({
    instagram: "",
    tiktok: "",
    youtube: "",
    telegram: "",
  });

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

  const handleSave = () => {
    // TODO: Save social links to backend
    setIsEditing(false);
    alert("Ijtimoiy tarmoq havolalari saqlandi!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">Profil</h1>
          <p className="font-body text-sm text-text-secondary">Ijtimoiy tarmoq havolalaringizni qo'shing</p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)} variant="outline">
            Tahrirlash
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>Shaxsiy ma'lumot</CardTitle>
            {data.socialAccounts && data.socialAccounts.length > 0 && (
              <Badge tone="accent" className="flex items-center gap-1">
                ✓ Tasdiqlangan Creator
              </Badge>
            )}
          </div>
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
              <dt className="font-body text-xs text-text-muted">O'zi haqida</dt>
              <dd className="font-body text-sm text-text-primary">{data.bio}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ijtimoiy tarmoq havolalari</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          {isEditing ? (
            <div className="space-y-4">
              <TextField
                label="Instagram"
                placeholder="https://instagram.com/username"
                value={socialLinks.instagram}
                onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
              />
              <TextField
                label="TikTok"
                placeholder="https://tiktok.com/@username"
                value={socialLinks.tiktok}
                onChange={(e) => setSocialLinks({ ...socialLinks, tiktok: e.target.value })}
              />
              <TextField
                label="YouTube"
                placeholder="https://youtube.com/@username"
                value={socialLinks.youtube}
                onChange={(e) => setSocialLinks({ ...socialLinks, youtube: e.target.value })}
              />
              <TextField
                label="Telegram"
                placeholder="https://t.me/username"
                value={socialLinks.telegram}
                onChange={(e) => setSocialLinks({ ...socialLinks, telegram: e.target.value })}
              />
              <div className="flex gap-2">
                <Button onClick={handleSave}>Saqlash</Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Bekor qilish
                </Button>
              </div>
            </div>
          ) : (
            <>
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
                <Alert tone="info">
                  Ijtimoiy tarmoq havolalari qo'shilmagan. Sofsavdo reklamasini qilganingiz uchun avtomatik ravishda "Tasdiqlangan Creator" badgesini olishingiz mumkin.
                </Alert>
              )}
            </>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>To'lov ma'lumoti</CardTitle>
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
          <p className="font-body text-sm text-text-muted">To'lov usuli kiritilmagan.</p>
        )}
      </Card>
    </div>
  );
}
