"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardHeader, CardTitle, SelectField, TextAreaField, TextField } from "@sofsavdo/ui";
import { competitionSchema, type CompetitionInput } from "@/lib/schemas-admin";
import { useCreateCompetition, useUpdateCompetition } from "@/services/admin/competitions";
import { ApiError, type CompetitionAdmin } from "@/lib/api/admin-real";

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
    watch,
    formState: { errors },
  } = useForm<CompetitionInput>({
    resolver: zodResolver(competitionSchema),
    defaultValues: existing
      ? {
          name: existing.name,
          description: existing.description ?? "",
          startAt: toDatetimeLocal(existing.startAt),
          endAt: toDatetimeLocal(existing.endAt),
          metric: (existing.metric as any) || "ORDER_COUNT",
          firstPrize: existing.firstPrize ?? "",
          secondPrize: existing.secondPrize ?? "",
          thirdPrize: existing.thirdPrize ?? "",
          imageUrl: existing.imageUrl ?? "",
        }
      : {
          metric: "ORDER_COUNT",
        },
  });

  const mutation = existing ? updateCompetition : createCompetition;
  const isArchived = existing?.status === "ARCHIVED";
  const watchedMetric = watch("metric");

  async function onSubmit(values: CompetitionInput) {
    try {
      const payload = {
        name: values.name,
        description: values.description || undefined,
        startAt: new Date(values.startAt).toISOString(),
        endAt: new Date(values.endAt).toISOString(),
        metric: values.metric,
        firstPrize: values.firstPrize,
        secondPrize: values.secondPrize,
        thirdPrize: values.thirdPrize,
        imageUrl: values.imageUrl || undefined,
      };
      if (existing) {
        await updateCompetition.mutateAsync(payload);
        router.push(`/admin/competitions/${existing.id}`);
      } else {
        const created = await createCompetition.mutateAsync(payload);
        router.push(`/admin/competitions/${created.id}`);
      }
    } catch (error) {
      console.error('Competition submission error:', error);
      throw error;
    }
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle>{existing ? "Musobaqani tahrirlash" : "Yangi musobaqa"}</CardTitle>
        <p className="font-body text-sm text-text-secondary">
          Creatorlar shu davr ichida buyurtma soni yoki taklif qilingan do'stlar soni bo'yicha reytingda ko'rinadi.
        </p>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <TextField label="Nomi" error={errors.name?.message} disabled={isArchived} {...register("name")} />
        <TextAreaField label="Tavsif (ixtiyoriy)" disabled={isArchived} {...register("description")} />
        
        <SelectField
          label="Metrika"
          error={errors.metric?.message}
          disabled={isArchived}
          {...register("metric")}
        >
          <option value="ORDER_COUNT">Buyurtma soni</option>
          <option value="REFERRAL_COUNT">Taklif qilingan do'stlar soni</option>
          <option value="INSTAGRAM_VIEWS">Instagram video ko'rishlar soni</option>
        </SelectField>

        {watchedMetric === "INSTAGRAM_VIEWS" ? (
          <Alert tone="info">
            Creatorlar video havola bilan ariza topshiradi, siz tasdiqlaysiz/rad etasiz, so&apos;ng
            har bir tasdiqlangan ishtirokchining ko&apos;rishlar sonini "Ishtirokchilar" bo&apos;limida
            qo&apos;lda yangilab turasiz — reyting shu songa qarab tuziladi.
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label="Boshlanish" type="datetime-local" error={errors.startAt?.message} disabled={isArchived} {...register("startAt")} />
          <TextField label="Tugash" type="datetime-local" error={errors.endAt?.message} disabled={isArchived} {...register("endAt")} />
        </div>

        <TextField label="1-o'rin sovrini" error={errors.firstPrize?.message} disabled={isArchived} {...register("firstPrize")} placeholder="Masalan: iPhone 15 Pro" />
        <TextField label="2-o'rin sovrini" error={errors.secondPrize?.message} disabled={isArchived} {...register("secondPrize")} placeholder="Masalan: AirPods Pro" />
        <TextField label="3-o'rin sovrini" error={errors.thirdPrize?.message} disabled={isArchived} {...register("thirdPrize")} placeholder="Masalan: 500,000 so'm" />
        
        <TextField label="Reklama rasm URL (ixtiyoriy)" error={errors.imageUrl?.message} disabled={isArchived} {...register("imageUrl")} placeholder="https://example.com/image.jpg" />

        {mutation.isError ? <Alert tone="error">{(mutation.error as ApiError).message}</Alert> : null}

        <Button type="submit" disabled={mutation.isPending || isArchived} className="w-fit">
          {mutation.isPending ? "Saqlanmoqda..." : existing ? "Saqlash" : "Yaratish"}
        </Button>
      </form>
    </Card>
  );
}
