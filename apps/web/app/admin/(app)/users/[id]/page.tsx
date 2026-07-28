"use client";

import { use, useState } from "react";
import Link from "next/link";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, ConfirmModal, Skeleton, TextField } from "@rosti/ui";
import { ArrowLeft } from "lucide-react";
import {
  useStaffUserDetail,
  useUpdateStaffUser,
  useActivateStaffUser,
  useDeactivateStaffUser,
  useResetStaffUserPassword,
  useAssignStaffUserRole,
  useRemoveStaffUserRole,
} from "@/services/admin/staff";
import { useRoleList } from "@/services/admin/roleManagement";
import { ApiError } from "@/lib/api/admin";

function UserDetailContent({ id }: { id: string }) {
  const query = useStaffUserDetail(id);
  const rolesQuery = useRoleList();
  const update = useUpdateStaffUser();
  const activate = useActivateStaffUser();
  const deactivate = useDeactivateStaffUser();
  const resetPassword = useResetStaffUserPassword();
  const assignRole = useAssignStaffUserRole();
  const removeRole = useRemoveStaffUserRole();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [addRoleId, setAddRoleId] = useState("");

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const user = query.data;
  if (!user) return <Alert tone="error">Foydalanuvchi topilmadi.</Alert>;

  const availableRoles = (rolesQuery.data ?? []).filter((r) => !user.roles.some((ur) => ur.id === r.id));
  const nameValue = displayName ?? user.displayName ?? "";

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-1 font-body text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="size-4" /> Ro&apos;yxatga qaytish
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-text-primary">{user.displayName ?? user.email}</h1>
          <p className="font-body text-sm text-text-muted">{user.email ?? user.phone}</p>
        </div>
        <Badge tone={user.status === "ACTIVE" ? "success" : "warning"}>{user.status === "ACTIVE" ? "Faol" : "Faolsizlantirilgan"}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-3">
          <TextField label="To'liq ism" value={nameValue} onChange={(e) => setDisplayName(e.target.value)} />
          <Button
            size="sm"
            className="w-fit"
            disabled={update.isPending || !displayName || displayName === user.displayName}
            onClick={() => update.mutate({ id, input: { displayName: displayName ?? undefined } })}
          >
            {update.isPending ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
          {update.isError ? <Alert tone="error">{(update.error as ApiError).message}</Alert> : null}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hisobni boshqarish</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          {user.status === "ACTIVE" ? (
            <Button size="sm" variant="outline" onClick={() => deactivate.mutate(id)} disabled={deactivate.isPending}>
              Faolsizlantirish
            </Button>
          ) : (
            <Button size="sm" onClick={() => activate.mutate(id)} disabled={activate.isPending}>
              Faollashtirish
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setPasswordModalOpen(true)}>
            Parolni tiklash
          </Button>
        </div>
        {deactivate.isError ? <Alert tone="error" className="mt-3">{(deactivate.error as ApiError).message}</Alert> : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rollar</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-3">
          <ul className="flex flex-wrap gap-2">
            {user.roles.map((r) => (
              <li key={r.id}>
                <Badge tone="neutral" className="flex items-center gap-1.5">
                  {r.name}
                  <button
                    type="button"
                    className="text-text-muted hover:text-error"
                    onClick={() => removeRole.mutate({ id, roleId: r.id })}
                    disabled={removeRole.isPending}
                    aria-label={`${r.name} rolini olib tashlash`}
                  >
                    ×
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
          {removeRole.isError ? <Alert tone="error">{(removeRole.error as ApiError).message}</Alert> : null}

          {availableRoles.length > 0 ? (
            <div className="flex items-center gap-2">
              <select value={addRoleId} onChange={(e) => setAddRoleId(e.target.value)} className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm">
                <option value="">Rol tanlang...</option>
                {availableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={!addRoleId || assignRole.isPending}
                onClick={() => {
                  assignRole.mutate({ id, roleId: addRoleId });
                  setAddRoleId("");
                }}
              >
                Qo&apos;shish
              </Button>
            </div>
          ) : null}
          {assignRole.isError ? <Alert tone="error">{(assignRole.error as ApiError).message}</Alert> : null}
        </div>
      </Card>

      <ConfirmModal
        open={passwordModalOpen}
        onClose={() => {
          setPasswordModalOpen(false);
          setNewPassword("");
        }}
        title="Parolni tiklash"
        description="Yangi parolni xodimga xavfsiz kanal orqali yetkazing."
        confirmLabel="Parolni o'rnatish"
        isPending={resetPassword.isPending}
        error={resetPassword.isError ? (resetPassword.error as ApiError).message : null}
        onConfirm={async () => {
          if (newPassword.length < 8) return;
          await resetPassword.mutateAsync({ id, newPassword });
          setPasswordModalOpen(false);
          setNewPassword("");
        }}
      >
        <div className="mt-4">
          <TextField label="Yangi parol" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} />
        </div>
      </ConfirmModal>
    </div>
  );
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RoleGuard min="SUPER_ADMIN">
      <UserDetailContent id={id} />
    </RoleGuard>
  );
}
