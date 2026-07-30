"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { Alert, Button, Card, CardHeader, CardTitle, TextField } from "@sofsavdo/ui";
import { useCreateStaffUser } from "@/services/admin/staff";
import { useRoleList } from "@/services/admin/roleManagement";
import { ApiError } from "@/lib/api/admin";

function NewStaffUserContent() {
  const router = useRouter();
  const rolesQuery = useRoleList();
  const createUser = useCreateStaffUser();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);

  function toggleRole(id: string) {
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const created = await createUser.mutateAsync({ displayName, email, password, roleIds });
    router.push(`/admin/users/${created.id}`);
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle>Yangi xodim</CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField label="To'liq ism" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required minLength={2} />
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <TextField label="Parol" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />

        <div>
          <p className="mb-2 font-body text-sm font-medium text-text-primary">Rollar</p>
          <div className="flex flex-col gap-1.5">
            {(rolesQuery.data ?? []).map((r) => (
              <label key={r.id} className="flex items-center gap-2 font-body text-sm text-text-secondary">
                <input type="checkbox" checked={roleIds.includes(r.id)} onChange={() => toggleRole(r.id)} />
                {r.name}
              </label>
            ))}
          </div>
        </div>

        {createUser.isError ? <Alert tone="error">{(createUser.error as ApiError).message}</Alert> : null}

        <Button type="submit" disabled={createUser.isPending || roleIds.length === 0} className="w-fit">
          {createUser.isPending ? "Yaratilmoqda..." : "Yaratish"}
        </Button>
      </form>
    </Card>
  );
}

export default function NewStaffUserPage() {
  return (
    <RoleGuard permission="user.manage">
      <NewStaffUserContent />
    </RoleGuard>
  );
}
