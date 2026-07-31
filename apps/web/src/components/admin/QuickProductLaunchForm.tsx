"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { Campaign, CommissionType, LandingSectionType, Offer, Product, ProductType } from "@sofsavdo/types";
import { Alert, Button, Card, CardHeader, CardTitle, IconButton, SelectField, TextAreaField, TextField } from "@sofsavdo/ui";
import {
  useActivateOffer,
  useAddLandingSection,
  useCreateLanding,
  useCreateOffer,
  useCreateProduct,
  usePublishLanding,
  useUploadImage,
} from "@/services/admin/catalog";
import { useActivateCampaign, useCreateCampaign } from "@/services/admin/campaigns";
import { ApiError, seedStandardDeliveryRegions } from "@/lib/api/admin";

const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: "PHYSICAL_PRODUCT", label: "Fizik mahsulot" },
  { value: "DIGITAL_PRODUCT", label: "Raqamli mahsulot" },
  { value: "COURSE", label: "Kurs" },
  { value: "SERVICE", label: "Xizmat" },
  { value: "CONSULTATION", label: "Konsultatsiya" },
];

// Same scaffold set the step-by-step wizard uses (ProductLaunchWizard.tsx) — a populated skeleton
// instead of a blank landing page, still fully editable afterward via SectionEditor.
const SCAFFOLD_SECTION_TYPES: LandingSectionType[] = ["HERO", "BENEFITS", "PRICING", "FAQ", "FINAL_CTA"];

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // A short random suffix, not a duplicate-check round-trip — Product/Offer/Campaign slugs are
    // each globally unique, and this form's whole point is removing manual steps, not adding a
    // "slug already taken, try again" retry loop for something the admin doesn't actually care
    // about here.
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "mahsulot"}-${suffix}`;
}

type Stage = "idle" | "submitting" | "done";

interface DoneResult {
  product: Product;
  offer: Offer;
  campaign: Campaign;
}

// The 4-step ProductLaunchWizard (Product -> Offer -> Landing -> Campaign, one full form each)
// technically works but is exactly the friction a real admin reported: too many screens, too many
// fields to understand, and — because Offer/Campaign default to DRAFT and nothing in that wizard
// activates them — a product created there can still end up invisible to both buyers and
// creators unless the admin *also* remembers to separately activate the Offer and Campaign
// afterward. This form collapses the same four creates into one screen with only the fields that
// actually differ product-to-product (name/photo/price/cost/commission), defaults everything else
// to a sensible value, and activates the Offer + Campaign (and publishes the Landing) as part of
// the same submit — so "mahsulot yaratish" and "buyer/creator uchun jonli" are the same action,
// not two the admin has to remember to do separately. The step-by-step wizard remains available
// (see /admin/products/launch/advanced) for admins who genuinely need per-field control (custom
// CTA copy, multiple price variants, follower-count gating, etc).
export function QuickProductLaunchForm({ existingProduct }: { existingProduct?: Product }) {
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<{ message: string; partial?: Partial<DoneResult> } | null>(null);
  const [result, setResult] = useState<DoneResult | null>(null);

  const [name, setName] = useState(existingProduct?.name ?? "");
  const [type, setType] = useState<ProductType>(existingProduct?.type ?? "PHYSICAL_PRODUCT");
  const [shortDescription, setShortDescription] = useState(existingProduct?.shortDescription ?? "");
  const [images, setImages] = useState<string[]>(existingProduct?.images ?? []);
  const [priceMinor, setPriceMinor] = useState("");
  const [compareAtPriceMinor, setCompareAtPriceMinor] = useState("");
  const [costPriceMinor, setCostPriceMinor] = useState(
    existingProduct?.costPriceMinor ? String(existingProduct.costPriceMinor / 100) : "",
  );
  const [category, setCategory] = useState("");
  const [commissionType, setCommissionType] = useState<CommissionType>("PERCENTAGE");
  const [commissionValue, setCommissionValue] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadImage = useUploadImage();
  const createProduct = useCreateProduct();
  const createOffer = useCreateOffer();
  const activateOffer = useActivateOffer();
  const createLanding = useCreateLanding();
  const addSection = useAddLandingSection();
  const publishLanding = usePublishLanding();
  const createCampaign = useCreateCampaign();
  const activateCampaign = useActivateCampaign();

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await uploadImage.mutateAsync(file);
    setImages((prev) => [...prev, url]);
  }

  function validate(): string | null {
    if (!existingProduct && name.trim().length < 3) return "Mahsulot nomini kiriting.";
    if (!priceMinor || Number(priceMinor) <= 0) return "Sotish narxini kiriting.";
    if (!commissionValue || Number(commissionValue) <= 0) return "Creator uchun komissiya qiymatini kiriting.";
    if (commissionType === "PERCENTAGE" && Number(commissionValue) > 90) return "Komissiya foizi 90% dan oshmasin.";
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError({ message: validationError });
      return;
    }
    setError(null);
    setStage("submitting");

    let product: Product | undefined = existingProduct;
    let offer: Offer | undefined;
    let campaign: Campaign | undefined;

    try {
      if (!product) {
        product = await createProduct.mutateAsync({
          name: name.trim(),
          slug: slugify(name),
          type,
          shortDescription: shortDescription.trim() || undefined,
          images,
          costPriceMinor: costPriceMinor ? Math.round(Number(costPriceMinor) * 100) : undefined,
          attributes: [],
        });
      }

      offer = await createOffer.mutateAsync({
        productId: product.id,
        name: product.name,
        slug: slugify(product.name),
        headline: product.name,
        subheadline: shortDescription.trim() || product.name,
        priceMinor: Math.round(Number(priceMinor) * 100),
        compareAtPriceMinor: compareAtPriceMinor ? Math.round(Number(compareAtPriceMinor) * 100) : undefined,
        currency: "UZS",
        variants: [{ id: "v1", name: "Standart", priceMinor: Math.round(Number(priceMinor) * 100), isDefault: true }],
        bonuses: [],
        // Includes COD ("naqd to'lov, yetkazilganda") and PAY_LATER ("bo'lib to'lash") by
        // default — both are already fully wired end-to-end server-side, and buyers expect them
        // available without the admin needing a separate step to turn them on.
        paymentOptions: ["CLICK", "PAYME", "CARD", "COD", "PAY_LATER"],
        ctaType: "BUY_NOW",
        ctaLabel: "Sotib olish",
      });
      await activateOffer.mutateAsync(offer.id);

      // Physical products need a real delivery-fee schedule before checkout works at all
      // (DeliveryService.resolveDeliveryFee throws REGION_REQUIRED with zero regions configured)
      // — bulk-seeding the standard Uzbekistan zone list here means the admin never has to
      // manually configure ~190 regions per offer just to make checkout functional.
      if (product.type === "PHYSICAL_PRODUCT") {
        await seedStandardDeliveryRegions(offer.id);
      }

      await createLanding.mutateAsync({ offerId: offer.id, input: {} });
      for (const sectionType of SCAFFOLD_SECTION_TYPES) {
        await addSection.mutateAsync({ offerId: offer.id, type: sectionType });
      }
      await publishLanding.mutateAsync(offer.id);

      const isPercent = commissionType === "PERCENTAGE";
      campaign = await createCampaign.mutateAsync({
        offerId: offer.id,
        name: `${product.name} — reklama kampaniyasi`,
        slug: slugify(`${product.name}-campaign`),
        category: category.trim() || "Umumiy",
        description: `${product.name} mahsulotini ijtimoiy tarmoqlarda reklama qiling.`,
        goal: "Sotuvlarni oshirish",
        targetAudience: "Sofsavdo xaridorlari",
        platforms: ["INSTAGRAM", "TIKTOK", "YOUTUBE", "TELEGRAM"],
        // CampaignsService.activate() refuses to go ACTIVE with an empty contentFormats list
        // (config-completeness check, see campaigns.service.ts) — a free-form string list, not an
        // enum, so any non-empty generic default satisfies it without forcing the admin to think
        // about content formats for the common case.
        contentFormats: ["Post", "Reels", "Story"],
        requiredElements: [],
        forbiddenElements: [],
        referenceContent: [],
        ctaLabel: "Sotib olish",
        applicationDeadline: new Date(Date.now() + 365 * 86_400_000).toISOString(),
        creatorLimit: 1000,
        commissionType,
        commissionRateBps: isPercent ? Math.round(Number(commissionValue) * 100) : undefined,
        commissionAmountMinor: isPercent ? undefined : Math.round(Number(commissionValue) * 100),
        barterEnabled: false,
        attributionWindowDays: 30,
        requiresApproval: false,
      });
      await activateCampaign.mutateAsync(campaign.id);

      setResult({ product, offer, campaign });
      setStage("done");
    } catch (err) {
      // Whatever succeeded before the failure is real and already saved — surfaced so the admin
      // can finish the rest from the normal standalone admin pages instead of re-doing it blind.
      setError({
        message: err instanceof Error ? err.message : "Yaratishda xatolik yuz berdi.",
        partial: { product, offer, campaign },
      });
      setStage("idle");
    }
  }

  if (stage === "done" && result) {
    return (
      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>Mahsulot jonli!</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-3">
          <Alert tone="success">
            &quot;{result.product.name}&quot; endi katalogda buyerlarga ko&apos;rinadi va creatorlar reklama
            kampaniyasiga qo&apos;shilishi mumkin — qo&apos;shimcha hech narsa qilish shart emas.
          </Alert>
          <div className="flex flex-wrap gap-3">
            <Link href={`/admin/products/${result.product.id}`} className="font-body text-sm text-accent underline">
              Mahsulotni ko&apos;rish
            </Link>
            <Link href={`/admin/offers/${result.offer.id}`} className="font-body text-sm text-accent underline">
              Offerni ko&apos;rish
            </Link>
            <Link href={`/admin/campaigns/${result.campaign.id}`} className="font-body text-sm text-accent underline">
              Campaignni ko&apos;rish
            </Link>
          </div>
          <Button variant="outline" className="w-fit" onClick={() => window.location.reload()}>
            Yana mahsulot yaratish
          </Button>
        </div>
      </Card>
    );
  }

  const isSubmitting = stage === "submitting";

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle>Tezkor mahsulot yaratish</CardTitle>
        <p className="font-body text-sm text-text-secondary">
          Faqat kerakli maydonlarni to&apos;ldiring — offer, landing va creator kampaniyasi avtomatik yaratiladi va
          darhol jonli holatga o&apos;tadi.
        </p>
      </CardHeader>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {!existingProduct ? (
          <>
            <TextField label="Mahsulot nomi" value={name} onChange={(e) => setName(e.target.value)} required />
            <SelectField label="Turi" value={type} onChange={(e) => setType(e.target.value as ProductType)}>
              {PRODUCT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </SelectField>
            <TextAreaField
              label="Qisqacha tavsif (ixtiyoriy)"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
            />

            <div>
              <p className="mb-1.5 font-body text-sm font-medium text-text-primary">Rasmlar</p>
              <div className="flex flex-wrap gap-3">
                {images.map((url, index) => (
                  <div key={url} className="relative size-24 overflow-hidden rounded-input border border-border">
                    <img src={url} alt="" className="size-full object-cover" />
                    <IconButton
                      type="button"
                      aria-label="Rasmni o'chirish"
                      size="sm"
                      className="absolute right-1 top-1 bg-dark/60 text-white hover:bg-dark/80"
                      onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <X className="size-3.5" />
                    </IconButton>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={uploadImage.isPending}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex size-24 flex-col items-center justify-center gap-1 rounded-input border border-dashed border-border font-body text-xs text-text-muted hover:border-accent hover:text-accent"
                >
                  {uploadImage.isPending ? "Yuklanmoqda..." : "+ Rasm yuklash"}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
              {uploadImage.isError ? (
                <p className="mt-1.5 font-body text-xs text-error">{(uploadImage.error as ApiError).message}</p>
              ) : null}
            </div>
          </>
        ) : (
          <Alert tone="info">
            &quot;{existingProduct.name}&quot; uchun offer va creator kampaniyasi yaratiladi — mahsulot
            ma&apos;lumotlari o&apos;zgarmaydi.
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Sotish narxi (so'm)"
            type="number"
            value={priceMinor}
            onChange={(e) => setPriceMinor(e.target.value)}
            required
          />
          <TextField
            label="Eski narx (ixtiyoriy, chegirma uchun)"
            type="number"
            value={compareAtPriceMinor}
            onChange={(e) => setCompareAtPriceMinor(e.target.value)}
          />
        </div>

        {!existingProduct ? (
          <TextField
            label="Yetkazib beruvchi/tan narxi (so'm, ixtiyoriy)"
            type="number"
            value={costPriceMinor}
            onChange={(e) => setCostPriceMinor(e.target.value)}
          />
        ) : null}

        <TextField
          label="Kategoriya (ixtiyoriy)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Masalan: Kiyim, Elektronika"
        />

        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Creator komissiyasi turi"
            value={commissionType}
            onChange={(e) => setCommissionType(e.target.value as CommissionType)}
          >
            <option value="PERCENTAGE">Foiz (%)</option>
            <option value="FIXED_AMOUNT">Belgilangan summa (so&apos;m)</option>
          </SelectField>
          <TextField
            label={commissionType === "PERCENTAGE" ? "Komissiya (%)" : "Komissiya (so'm)"}
            type="number"
            value={commissionValue}
            onChange={(e) => setCommissionValue(e.target.value)}
            required
          />
        </div>

        {error ? (
          <Alert tone="error">
            {error.message}
            {error.partial?.product || error.partial?.offer || error.partial?.campaign ? (
              <div className="mt-2 flex flex-wrap gap-3">
                {error.partial.product ? (
                  <Link href={`/admin/products/${error.partial.product.id}`} className="underline">
                    Mahsulot yaratildi — davom ettirish
                  </Link>
                ) : null}
                {error.partial.offer ? (
                  <Link href={`/admin/offers/${error.partial.offer.id}`} className="underline">
                    Offer yaratildi — davom ettirish
                  </Link>
                ) : null}
                {error.partial.campaign ? (
                  <Link href={`/admin/campaigns/${error.partial.campaign.id}`} className="underline">
                    Campaign yaratildi — davom ettirish
                  </Link>
                ) : null}
              </div>
            ) : null}
          </Alert>
        ) : null}

        <Button type="submit" disabled={isSubmitting} className="w-fit">
          {isSubmitting ? "Yaratilmoqda..." : "Yaratish va jonli qilish"}
        </Button>
      </form>
    </Card>
  );
}
