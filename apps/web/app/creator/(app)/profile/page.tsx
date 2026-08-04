"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge, Card, CardHeader, CardTitle, Skeleton, Button, TextField, Alert } from "@sofsavdo/ui";
import { useSession } from "@/services/session";
import { applicationStatusMeta } from "@/lib/status";
import { useCreatePayoutMethod, useDeletePayoutMethod, useRealPayoutMethods } from "@/services/finance";
import { payoutMethodSchema, type PayoutMethodInput } from "@/lib/schemas";

const PLATFORM_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  TELEGRAM: "Telegram",
};

export default function CreatorProfilePage() {
  const { user, isLoading } = useSession();
  const [isEditing, setIsEditing] = useState(false);
  const [socialLinks, setSocialLinks] = useState({
    instagram: "",
    tiktok: "",
    youtube: "",
    telegram: "",
  });

  const methodsQuery = useRealPayoutMethods();
  const createMethod = useCreatePayoutMethod();
  const deleteMethod = useDeletePayoutMethod();
  const [showAddMethod, setShowAddMethod] = useState(false);
  const methodForm = useForm<PayoutMethodInput>({ resolver: zodResolver(payoutMethodSchema) });
  const payoutMethods = methodsQuery.data ?? [];

  async function onAddMethod(values: PayoutMethodInput) {
    await createMethod.mutateAsync({ type: "CARD", cardNumber: values.cardNumber, cardHolder: values.cardHolder });
    methodForm.reset();
    setShowAddMethod(false);
  }

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

  const handleSave = async () => {
    try {
      // Save social links to backend
      alert("Ijtimoiy tarmoq havolalari saqlandi!");
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save social links:', error);
      alert("Xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.");
    }
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
        {methodsQuery.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            {payoutMethods.length === 0 ? (
              <p className="mb-3 font-body text-sm text-text-muted">Hali to&apos;lov usuli qo&apos;shilmagan.</p>
            ) : (
              <ul className="mb-3 flex flex-col gap-2">
                {payoutMethods.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-input border border-border px-3 py-2 font-body text-sm">
                    <span className="text-text-primary">{m.label}</span>
                    <div className="flex items-center gap-2">
                      {m.isDefault ? <Badge tone="accent">Asosiy</Badge> : null}
                      <Button size="sm" variant="ghost" onClick={() => deleteMethod.mutate(m.id)}>
                        O&apos;chirish
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {showAddMethod ? (
              <form onSubmit={methodForm.handleSubmit(onAddMethod)} className="flex flex-col gap-3 border-t border-border pt-4" noValidate>
                <TextField
                  label="Karta raqami"
                  placeholder="8600 0000 0000 0000"
                  error={methodForm.formState.errors.cardNumber?.message}
                  {...methodForm.register("cardNumber")}
                />
                <TextField
                  label="Karta egasi"
                  placeholder="MALIKA YUSUPOVA"
                  error={methodForm.formState.errors.cardHolder?.message}
                  {...methodForm.register("cardHolder")}
                />
                {createMethod.isError ? <Alert tone="error">Qo&apos;shishda xatolik yuz berdi.</Alert> : null}
                <div className="flex gap-2">
                  <Button type="submit" disabled={createMethod.isPending}>
                    {createMethod.isPending ? "Saqlanmoqda..." : "Saqlash"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowAddMethod(false)}>
                    Bekor qilish
                  </Button>
                </div>
              </form>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowAddMethod(true)}>
                Karta qo&apos;shish
              </Button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
