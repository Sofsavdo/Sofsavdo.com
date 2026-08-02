"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import type { Campaign, CommissionType, DiscountType, SocialPlatform } from "@sofsavdo/types";
import { Alert, Button, Card, CardHeader, CardTitle, SelectField, TextAreaField, TextField } from "@sofsavdo/ui";
import { campaignSchema, type CampaignInput } from "@/lib/schemas-admin";
import { useAdminOffers } from "@/services/admin/catalog";
import { useCreateCampaign, useUpdateCampaign } from "@/services/admin/campaigns";
import { ApiError } from "@/lib/api/admin";

const PLATFORMS: SocialPlatform[] = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "TELEGRAM"];
const COMMISSION_TYPES: CommissionType[] = ["PERCENTAGE", "FIXED_AMOUNT"];

export function CampaignForm({
  existing,
  defaultOfferId,
  onCreated,
}: {
  existing?: Campaign;
  defaultOfferId?: string;
  onCreated?: (created: Campaign) => void;
}) {
  const router = useRouter();
  const offersQuery = useAdminOffers();
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();

  const [platforms, setPlatforms] = useState<SocialPlatform[]>(existing?.platforms ?? ["INSTAGRAM"]);
  const [contentFormats, setContentFormats] = useState((existing?.contentFormats ?? []).join("\n"));
  const [requiredElements, setRequiredElements] = useState((existing?.requiredElements ?? []).join("\n"));
  const [forbiddenElements, setForbiddenElements] = useState((existing?.forbiddenElements ?? []).join("\n"));
  const [referenceContent, setReferenceContent] = useState((existing?.referenceContent ?? []).join("\n"));
  const [customerDiscountType, setCustomerDiscountType] = useState<DiscountType | "">(existing?.customerDiscountType ?? "");
  const [customerDiscountValue, setCustomerDiscountValue] = useState(existing?.customerDiscountValue ? String(existing.customerDiscountValue / 100) : "");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CampaignInput>({
    resolver: zodResolver(campaignSchema),
    defaultValues: existing
      ? {
          offerId: existing.offer.id,
          name: existing.name,
          slug: existing.slug,
          category: existing.category,
          description: existing.description,
          goal: existing.goal,
          targetAudience: existing.targetAudience,
          ctaLabel: existing.ctaLabel,
          applicationDeadline: existing.applicationDeadline?.slice(0, 10),
          creatorLimit: String(existing.creatorLimit),
          commissionType: existing.commissionType,
          commissionValue:
            existing.commissionType === "PERCENTAGE"
              ? String((existing.commissionRateBps ?? 0) / 100)
              : String((existing.commissionAmountMinor ?? 0) / 100),
          barterEnabled: existing.barterEnabled,
          freeProduct: existing.freeProduct,
          attributionWindowDays: String(existing.attributionWindowDays),
          requiresApproval: existing.requiresApproval,
        }
      : {
          offerId: defaultOfferId,
          commissionType: "PERCENTAGE",
          creatorLimit: "20",
          attributionWindowDays: "30",
          barterEnabled: false,
          requiresApproval: true,
          applicationDeadline: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
        },
  });

  const commissionType = watch("commissionType");
  const mutation = existing ? updateCampaign : createCampaign;

  // The offers list loads async; a native <select> registered with react-hook-form falls back to
  // its first option ("Tanlang") when the default value's <option> doesn't exist yet at mount, and
  // RHF reads the DOM value at submit — so without this, editing an existing campaign silently
  // submitted offerId="" (real bug found during Campaign browser verification).
  const offerId = existing?.offer.id ?? defaultOfferId;
  const offersLoaded = !!offersQuery.data;
  useEffect(() => {
    if (offersLoaded && offerId) setValue("offerId", offerId);
  }, [offersLoaded, offerId, setValue]);

  async function onSubmit(values: CampaignInput) {
    const isPercent = values.commissionType === "PERCENTAGE";
    const payload = {
      offerId: values.offerId,
      name: values.name,
      slug: values.slug,
      category: values.category,
      description: values.description,
      goal: values.goal,
      targetAudience: values.targetAudience,
      platforms,
      contentFormats: contentFormats.split("\n").map((s) => s.trim()).filter(Boolean),
      requiredElements: requiredElements.split("\n").map((s) => s.trim()).filter(Boolean),
      forbiddenElements: forbiddenElements.split("\n").map((s) => s.trim()).filter(Boolean),
      referenceContent: referenceContent.split("\n").map((s) => s.trim()).filter(Boolean),
      ctaLabel: values.ctaLabel,
      applicationDeadline: new Date(values.applicationDeadline).toISOString(),
      creatorLimit: Number(values.creatorLimit),
      commissionType: values.commissionType,
      commissionRateBps: isPercent ? Math.round(Number(values.commissionValue) * 100) : undefined,
      commissionAmountMinor: isPercent ? undefined : Math.round(Number(values.commissionValue) * 100),
      customerDiscountType: customerDiscountType || undefined,
      customerDiscountValue: customerDiscountValue
        ? customerDiscountType === "PERCENTAGE"
          ? Math.round(Number(customerDiscountValue) * 100)
          : Math.round(Number(customerDiscountValue) * 100)
        : undefined,
      barterEnabled: values.barterEnabled,
      freeProduct: values.freeProduct,
      attributionWindowDays: Number(values.attributionWindowDays),
      requiresApproval: values.requiresApproval,
      assets: existing?.assets ?? [],
    };
    if (existing) {
      await updateCampaign.mutateAsync({ id: existing.id, patch: payload });
      router.push(`/admin/campaigns/${existing.id}`);
    } else {
      const created = await createCampaign.mutateAsync(payload);
      if (onCreated) onCreated(created);
      else router.push(`/admin/campaigns/${created.id}`);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle>{existing ? "Kampaniyani tahrirlash" : "Yangi campaign"}</CardTitle>
        <p className="font-body text-sm text-text-secondary">Campaign — faqat creatorlar uchun reklama kampaniyasi, bitta Offer asosida.</p>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <SelectField label="Offer" error={errors.offerId?.message} {...register("offerId")}>
          <option value="">Tanlang</option>
          {(offersQuery.data ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </SelectField>
        <TextField label="Kampaniya nomi" error={errors.name?.message} {...register("name")} />
        <TextField label="URL manzili" error={errors.slug?.message} {...register("slug")} />
        <TextField label="Kategoriya" error={errors.category?.message} {...register("category")} />
        <TextAreaField label="Tavsif" error={errors.description?.message} {...register("description")} />
        <TextField label="Maqsad" error={errors.goal?.message} {...register("goal")} />
        <TextField label="Target audience" error={errors.targetAudience?.message} {...register("targetAudience")} />

        <div>
          <p className="mb-1.5 font-body text-sm font-medium text-text-primary">Platformalar</p>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <label key={p} className="flex items-center gap-1.5 rounded-input border border-border px-3 py-1.5 font-body text-sm">
                <input
                  type="checkbox"
                  checked={platforms.includes(p)}
                  onChange={(e) => setPlatforms((list) => (e.target.checked ? [...list, p] : list.filter((x) => x !== p)))}
                />
                {p}
              </label>
            ))}
          </div>
        </div>

        <TextAreaField label="Kontent formatlari (har birini yangi qatordan)" value={contentFormats} onChange={(e) => setContentFormats(e.target.value)} />
        <TextAreaField label="Majburiy elementlar / talking points" value={requiredElements} onChange={(e) => setRequiredElements(e.target.value)} />
        <TextAreaField label="Taqiqlangan da'volar" value={forbiddenElements} onChange={(e) => setForbiddenElements(e.target.value)} />
        <TextAreaField label="Reference kontent (havolalar)" value={referenceContent} onChange={(e) => setReferenceContent(e.target.value)} />

        <TextField label="CTA matni" error={errors.ctaLabel?.message} {...register("ctaLabel")} />

        <div className="grid grid-cols-2 gap-3">
          <TextField label="Ariza muddati" type="date" error={errors.applicationDeadline?.message} {...register("applicationDeadline")} />
          <TextField label="Creator limiti" error={errors.creatorLimit?.message} {...register("creatorLimit")} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Komissiya turi" error={errors.commissionType?.message} {...register("commissionType")}>
            {COMMISSION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectField>
          <TextField
            label={commissionType === "PERCENTAGE" ? "Komissiya (%)" : "Komissiya (so'm)"}
            error={errors.commissionValue?.message}
            {...register("commissionValue")}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Xaridor chegirmasi turi" value={customerDiscountType} onChange={(e) => setCustomerDiscountType(e.target.value as DiscountType | "")}>
            <option value="">Yo&apos;q</option>
            <option value="PERCENTAGE">Foiz</option>
            <option value="FIXED_AMOUNT">Belgilangan summa</option>
          </SelectField>
          <TextField label="Chegirma qiymati" value={customerDiscountValue} onChange={(e) => setCustomerDiscountValue(e.target.value)} disabled={!customerDiscountType} />
        </div>

        <label className="flex items-center gap-2 font-body text-sm text-text-secondary">
          <input type="checkbox" {...register("barterEnabled")} /> Barter yoqilgan
        </label>
        <TextField label="Bepul mahsulot (ixtiyoriy)" {...register("freeProduct")} />

        <TextField label="Attribution muddati (kun)" error={errors.attributionWindowDays?.message} {...register("attributionWindowDays")} />

        <label className="flex items-center gap-2 font-body text-sm text-text-secondary">
          <input type="checkbox" {...register("requiresApproval")} /> Creator arizasi admin tasdig&apos;ini talab qiladi
        </label>

        {mutation.isError ? <Alert tone="error">{(mutation.error as ApiError).message}</Alert> : null}

        <Button type="submit" disabled={mutation.isPending} className="w-fit">
          {mutation.isPending ? "Saqlanmoqda..." : existing ? "Saqlash" : "Yaratish"}
        </Button>
      </form>
    </Card>
  );
}
