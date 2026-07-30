"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { Alert, Button, Card, CardHeader, CardTitle, TextAreaField, TextField } from "@sofsavdo/ui";
import { useCreateRole } from "@/services/admin/roleManagement";
import { ApiError } from "@/lib/api/admin";

function NewRoleContent() {
  const router = useRouter();
  const createRole = useCreateRole();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const created = await createRole.mutateAsync({ key, name, description: description || undefined });
    router.push(`/admin/roles/${(created as { id: string }).id}`);
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle>Yangi rol</CardTitle>
        <p className="font-body text-sm text-text-secondary">Key yaratilgach o&apos;zgartirib bo&apos;lmaydi.</p>
      </CardHeader>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Key"
          placeholder="masalan: support_staff"
          value={key}
          onChange={(e) => setKey(e.target.value.toLowerCase())}
          pattern="^[a-z][a-z0-9_]*$"
          required
        />
        <TextField label="Nomi" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        <TextAreaField label="Tavsif (ixtiyoriy)" value={description} onChange={(e) => setDescription(e.target.value)} />

        {createRole.isError ? <Alert tone="error">{(createRole.error as ApiError).message}</Alert> : null}

        <Button type="submit" disabled={createRole.isPending} className="w-fit">
          {createRole.isPending ? "Yaratilmoqda..." : "Yaratish"}
        </Button>
      </form>
    </Card>
  );
}

export default function NewRolePage() {
  return (
    <RoleGuard permission="role.manage">
      <NewRoleContent />
    </RoleGuard>
  );
}
