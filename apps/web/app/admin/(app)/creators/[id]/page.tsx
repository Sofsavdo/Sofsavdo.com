"use client";

import { use, useState } from "react";
import { formatMoneyMinor } from "@rosti/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, ConfirmModal, Skeleton, StatTile, StatusBadge } from "@rosti/ui";
import { useAdminSession } from "@/services/adminSession";
import { hasRole } from "@/lib/adminRouting";
import {
  useAdminCreator,
  useCreatorCampaignHistory,
  useCreatorStats,
  useApproveCreatorApplication,
  useRejectCreatorApplication,
  useRequestCreatorRevision,
  useSetCreatorAccountStatus,
} from "@/services/admin/creators";
import { applicationStatusMeta, creatorAccountStatusMeta, creatorCampaignStatusMeta } from "@/lib/status";
import { ApiError } from "@/lib/api/admin";

export default function CreatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user: admin } = useAdminSession();
  const creatorQuery = useAdminCreator(id);
  const historyQuery = useCreatorCampaignHistory(id);
  const statsQuery = useCreatorStats(id);
  const approve = useApproveCreatorApplication();
  const reject = useRejectCreatorApplication();
  const revision = useRequestCreatorRevision();
  const setStatus = useSetCreatorAccountStatus();
  const [modal, setModal] = useState<"reject" | "revision" | "suspend" | "block" | null>(null);

  if (creatorQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const creator = creatorQuery.data;
  if (!creator) return <Alert tone="error">Creator topilmadi.</Alert>;

  const canSeePayoutDetails = hasRole(admin?.role, "ADMIN");
  const app = creator.application;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-accent/10 font-numeric text-sm font-semibold text-accent">
            {creator.avatarInitials}
          </span>
          <div>
            <h1 className="font-heading text-xl font-bold text-text-primary">{creator.displayName}</h1>
            <p className="font-body text-sm text-text-muted">{creator.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone={applicationStatusMeta[app.status].tone} label={applicationStatusMeta[app.status].label} />
          <StatusBadge tone={creatorAccountStatusMeta[creator.accountStatus ?? "ACTIVE"].tone} label={creatorAccountStatusMeta[creator.accountStatus ?? "ACTIVE"].label} />
        </div>
      </div>

      {app.status === "SUBMITTED" || app.status === "UNDER_REVIEW" ? (
        <Card>
          <CardHeader>
            <CardTitle>Ariza bo&apos;yicha qaror</CardTitle>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => approve.mutate(creator.id)} disabled={approve.isPending}>
              Tasdiqlash
            </Button>
            <Button size="sm" variant="outline" onClick={() => setModal("revision")}>
              Tuzatish so&apos;rash
            </Button>
            <Button size="sm" variant="outline" className="border-error text-error" onClick={() => setModal("reject")}>
              Rad etish
            </Button>
          </div>
        </Card>
      ) : null}

      {app.reviewNote ? <Alert tone={app.status === "REJECTED" ? "error" : "warning"}>{app.reviewNote}</Alert> : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Click" value={statsQuery.data?.clicks ?? 0} />
        <StatTile label="Buyurtmalar" value={statsQuery.data?.totalOrders ?? 0} />
        <StatTile label="Jami tushum" value={formatMoneyMinor(statsQuery.data?.totalRevenueMinor ?? 0)} />
        <StatTile label="Jami komissiya" value={formatMoneyMinor(statsQuery.data?.totalCommissionMinor ?? 0)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
          </CardHeader>
          <dl className="space-y-2 font-body text-sm">
            <div className="flex justify-between">
              <dt className="text-text-muted">Shahar</dt>
              <dd className="text-text-primary">{app.data.city ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Telefon</dt>
              <dd className="text-text-primary">{app.data.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Bio</dt>
              <dd className="mt-1 text-text-primary">{app.data.bio ?? "—"}</dd>
            </div>
            <div>
              <dt className="mb-1 text-text-muted">Kontent yo&apos;nalishlari</dt>
              <dd className="flex flex-wrap gap-1.5">
                {(app.data.contentNiches ?? []).map((n) => (
                  <Badge key={n} tone="neutral">
                    {n}
                  </Badge>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Auditoriya</dt>
              <dd className="text-text-primary">
                {app.data.audienceAgeRange ?? "—"} · {app.data.audienceGeography ?? "—"}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ijtimoiy tarmoqlar</CardTitle>
          </CardHeader>
          {(app.data.socialAccounts ?? []).length === 0 ? (
            <p className="font-body text-sm text-text-muted">Kiritilmagan.</p>
          ) : (
            <ul className="space-y-2">
              {(app.data.socialAccounts ?? []).map((sa) => (
                <li key={sa.id} className="flex items-center justify-between font-body text-sm">
                  <span className="text-text-primary">
                    {sa.platform} · {sa.handle}
                  </span>
                  <span className="font-numeric tabular-nums text-text-secondary">{sa.followerCount.toLocaleString("uz-UZ")}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>To&apos;lov ma&apos;lumotlari</CardTitle>
        </CardHeader>
        {canSeePayoutDetails ? (
          <div className="font-body text-sm text-text-primary">
            {app.data.payoutMethodType === "CARD" ? (
              <p>
                {app.data.payoutCardNumber} — {app.data.payoutCardHolder}
              </p>
            ) : app.data.payoutBankName ? (
              <p>
                {app.data.payoutBankName} — {app.data.payoutBankAccount}
              </p>
            ) : (
              <p className="text-text-muted">Kiritilmagan.</p>
            )}
          </div>
        ) : (
          <p className="font-body text-sm text-text-muted">
            To&apos;lov ma&apos;lumotlarini ko&apos;rish uchun Admin yoki undan yuqori ruxsat kerak.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kampaniya tarixi</CardTitle>
        </CardHeader>
        {(historyQuery.data ?? []).length === 0 ? (
          <p className="font-body text-sm text-text-muted">Hali kampaniyaga qo&apos;shilmagan.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(historyQuery.data ?? []).map((cc) => (
              <li key={cc.id} className="flex items-center justify-between py-2.5 font-body text-sm">
                <span className="text-text-primary">{cc.campaign.name}</span>
                <Badge tone={creatorCampaignStatusMeta[cc.status].tone}>{creatorCampaignStatusMeta[cc.status].label}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {creator.accountStatus !== "BLOCKED" ? (
        <Card>
          <CardHeader>
            <CardTitle>Hisobni boshqarish</CardTitle>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            {creator.accountStatus !== "SUSPENDED" ? (
              <Button variant="outline" size="sm" onClick={() => setModal("suspend")}>
                Vaqtincha to&apos;xtatish
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setStatus.mutate({ userId: creator.id, status: "ACTIVE" })}>
                Faollashtirish
              </Button>
            )}
            <Button variant="outline" size="sm" className="border-error text-error" onClick={() => setModal("block")}>
              Bloklash
            </Button>
          </div>
        </Card>
      ) : null}

      <ConfirmModal
        open={modal === "reject" || modal === "revision"}
        onClose={() => setModal(null)}
        title={modal === "reject" ? "Arizani rad etish" : "Tuzatish so'rash"}
        requireReason
        destructive={modal === "reject"}
        isPending={reject.isPending || revision.isPending}
        error={reject.isError ? (reject.error as ApiError).message : revision.isError ? (revision.error as ApiError).message : null}
        onConfirm={async (reason) => {
          if (!reason) return;
          if (modal === "reject") await reject.mutateAsync({ userId: creator.id, reason });
          else await revision.mutateAsync({ userId: creator.id, reason });
          setModal(null);
        }}
      />

      <ConfirmModal
        open={modal === "suspend" || modal === "block"}
        onClose={() => setModal(null)}
        title={modal === "block" ? "Creatorni bloklash" : "Vaqtincha to'xtatish"}
        description={modal === "block" ? "Bloklangan creator tizimga kira olmaydi." : "Creator vaqtincha kira olmaydi, kerak bo'lsa qayta faollashtirish mumkin."}
        requireReason
        destructive
        isPending={setStatus.isPending}
        onConfirm={async (reason) => {
          await setStatus.mutateAsync({ userId: creator.id, status: modal === "block" ? "BLOCKED" : "SUSPENDED", reason });
          setModal(null);
        }}
      />
    </div>
  );
}
