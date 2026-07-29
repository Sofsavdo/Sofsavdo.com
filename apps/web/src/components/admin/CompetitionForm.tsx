"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardHeader, CardTitle, TextAreaField, TextField } from "@sofsavdo/ui";
import { competitionSchema, type CompetitionInput } from "@/lib/schemas-admin";
import { useCreateCompetition, useUpdateCompetition } from "@/services/admin/competitions";
import { ApiError, type CompetitionAdmin } from "@/lib/api/admin";

// datetime-local input needs "YYYY-MM-DDTHH:mm", not a full ISO string with seconds/Z.
function toDatetimeLocal(iso: string): string {
  return iso.slice(0, 16);
}

export function CompetitionForm({ existing }: { existing?: CompetitionAdmin }) {
  const router = useRouter();
  const createCompetition = useCreateCompetition();
  const updateCompetition = useUpdateCompetition(existing?.id ?? "");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompetitionInput>({
    resolver: zodResolver(competitionSchema),
    defaultValues: existing
      ? {
          name: existing.name,
          slug: existing.slug,
          description: existing.description ?? "",
          prizeDescription: existing.prizeDescription ?? "",
          startAt: toDatetimeLocal(existing.startAt),
          endAt: toDatetimeLocal(existing.endAt),
        }
      : {},
  });

  const mutation = existing ? updateCompetition : createCompetition;
  const isArchived = existing?.status === "ARCHIVED";

  async function onSubmit(values: CompetitionInput) {
    const payload = {
      name: values.name,
      slug: values.slug,
      description: values.description || undefined,
      prizeDescription: values.prizeDescription || undefined,
      startAt: new Date(values.startAt).toISOString(),
      endAt: new Date(values.endAt).toISOString(),
    };
    if (existing) {
      await updateCompetition.mutateAsync(payload);
      router.push(`/admin/competitions/${existing.id}`);
    } else {
      const created = await createCompetition.mutateAsync(payload);
      router.push(`/admin/competitions/${created.id}`);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle>{existing ? "Musobaqani tahrirlash" : "Yangi musobaqa"}</CardTitle>
        <p className="font-body text-sm text-text-secondary">
          Creatorlar shu davr ichida ishlab topgan komissiya bo&apos;yicha reytingda ko&apos;rinadi.
        </p>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <TextField label="Nomi" error={errors.name?.message} disabled={isArchived} {...register("name")} />
        <TextField label="Slug" error={errors.slug?.message} disabled={isArchived} {...register("slug")} />
        <TextAreaField label="Tavsif (ixtiyoriy)" disabled={isArchived} {...register("description")} />
        <TextAreaField label="Sovg'a tavsifi (ixtiyoriy)" disabled={isArchived} {...register("prizeDescription")} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label="Boshlanish" type="datetime-local" error={errors.startAt?.message} disabled={isArchived} {...register("startAt")} />
          <TextField label="Tugash" type="datetime-local" error={errors.endAt?.message} disabled={isArchived} {...register("endAt")} />
        </div>

        {mutation.isError ? <Alert tone="error">{(mutation.error as ApiError).message}</Alert> : null}

        <Button type="submit" disabled={mutation.isPending || isArchived} className="w-fit">
          {mutation.isPending ? "Saqlanmoqda..." : existing ? "Saqlash" : "Yaratish"}
        </Button>
      </form>
    </Card>
  );
}
