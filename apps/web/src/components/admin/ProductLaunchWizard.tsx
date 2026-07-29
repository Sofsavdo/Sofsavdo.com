"use client";

import { useState } from "react";
import Link from "next/link";
import type { Campaign, LandingSectionType, Offer, Product } from "@sofsavdo/types";
import { Alert, Button, Card, CardHeader, CardTitle } from "@sofsavdo/ui";
import { ProductForm } from "./ProductForm";
import { OfferForm } from "./OfferForm";
import { CampaignForm } from "./CampaignForm";
import { ProductAiDraftPanel } from "./ProductAiDraftPanel";
import { useAddLandingSection, useCreateLanding } from "@/services/admin/catalog";
import type { ProductAiDraft } from "@/lib/api/admin";

// Default skeleton for a freshly-scaffolded landing — matches the section types every landing
// eventually needs, per the existing SectionEditor's own type list (apps/api's LandingSectionType
// enum). Admin edits/reorders/removes these afterward through the existing, unmodified
// SectionEditor — this wizard only saves the first "start from a blank page" step, never
// constrains what happens next.
const SCAFFOLD_SECTION_TYPES: LandingSectionType[] = ["HERO", "BENEFITS", "PRICING", "FAQ", "FINAL_CTA"];

type Step = "product" | "offer" | "landing" | "campaign" | "done";

const STEP_LABELS: Record<Exclude<Step, "done">, string> = {
  product: "Mahsulot",
  offer: "Offer",
  landing: "Landing",
  campaign: "Campaign",
};
const STEP_ORDER: Exclude<Step, "done">[] = ["product", "offer", "landing", "campaign"];

function WizardProgress({ current }: { current: Step }) {
  const currentIndex = current === "done" ? STEP_ORDER.length : STEP_ORDER.indexOf(current);
  return (
    <div className="mb-6 flex items-center gap-2">
      {STEP_ORDER.map((step, i) => (
        <div key={step} className="flex flex-1 items-center gap-2">
          <div
            className={`flex size-7 shrink-0 items-center justify-center rounded-full font-body text-xs font-semibold ${
              i < currentIndex
                ? "bg-accent text-white"
                : i === currentIndex
                  ? "border-2 border-accent text-accent"
                  : "border border-border text-text-muted"
            }`}
          >
            {i + 1}
          </div>
          <span className={`font-body text-sm ${i === currentIndex ? "font-semibold text-text-primary" : "text-text-muted"}`}>
            {STEP_LABELS[step]}
          </span>
          {i < STEP_ORDER.length - 1 ? <div className="h-px flex-1 bg-border" /> : null}
        </div>
      ))}
    </div>
  );
}

// Chains the four existing, independently-working admin create flows (Product/Offer/Landing/
// Campaign) into one guided sequence — no new backend endpoints, no schema changes. Every entity
// this creates is a completely normal row, editable afterward through its own existing standalone
// admin page exactly as if it had been created the old way. See DECISIONS.md's architecture
// review entry for why this is a workflow fix, not a data-model merge: Campaign is genuinely 1:many
// with Offer (multiple recruitment drives with different terms are a real, supported case), so
// the Campaign step stays explicitly optional rather than auto-created.
export function ProductLaunchWizard() {
  const [step, setStep] = useState<Step>("product");
  const [product, setProduct] = useState<Product | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [landingScaffolding, setLandingScaffolding] = useState(false);
  const [landingError, setLandingError] = useState<string | null>(null);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [aiDraft, setAiDraft] = useState<ProductAiDraft | null>(null);

  const createLanding = useCreateLanding();
  const addSection = useAddLandingSection();

  async function scaffoldLanding(createdOffer: Offer) {
    setOffer(createdOffer);
    setStep("landing");
    setLandingScaffolding(true);
    setLandingError(null);
    try {
      await createLanding.mutateAsync({ offerId: createdOffer.id, input: {} });
      for (const type of SCAFFOLD_SECTION_TYPES) {
        // When an AI draft was generated and used (Phase I), BENEFITS/FAQ start pre-populated with
        // its benefits/faq content instead of empty — still fully editable afterward through the
        // existing, unmodified SectionEditor, same as every other scaffolded section.
        const content =
          type === "BENEFITS" && aiDraft?.benefits.length
            ? { items: aiDraft.benefits }
            : type === "FAQ" && aiDraft?.faq.length
              ? { items: aiDraft.faq.map((f) => ({ q: f.question, a: f.answer })) }
              : undefined;
        await addSection.mutateAsync({ offerId: createdOffer.id, type, ...(content ? { content } : {}) });
      }
      setStep("campaign");
    } catch (err) {
      setLandingError(err instanceof Error ? err.message : "Landing yaratishda xatolik yuz berdi.");
    } finally {
      setLandingScaffolding(false);
    }
  }

  function reset() {
    setStep("product");
    setProduct(null);
    setOffer(null);
    setCampaign(null);
    setShowCampaignForm(false);
    setAiDraft(null);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <WizardProgress current={step} />

      {step === "product" ? (
        <div className="flex flex-col gap-4">
          <ProductAiDraftPanel onUse={setAiDraft} />
          <ProductForm
            aiPrefill={aiDraft ? { title: aiDraft.title, shortDescription: aiDraft.shortDescription } : undefined}
            onCreated={(created) => {
              setProduct(created);
              setStep("offer");
            }}
          />
        </div>
      ) : null}

      {step === "offer" && product ? <OfferForm defaultProductId={product.id} onCreated={scaffoldLanding} /> : null}

      {step === "landing" ? (
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle>Landing sahifa tayyorlanmoqda</CardTitle>
          </CardHeader>
          {landingScaffolding ? (
            <p className="font-body text-sm text-text-secondary">Standart bo&apos;limlar qo&apos;shilmoqda...</p>
          ) : landingError ? (
            <div className="flex flex-col gap-3">
              <Alert tone="error">{landingError}</Alert>
              <Button variant="outline" className="w-fit" onClick={() => offer && scaffoldLanding(offer)}>
                Qayta urinish
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      {step === "campaign" && offer ? (
        showCampaignForm ? (
          <CampaignForm
            defaultOfferId={offer.id}
            onCreated={(created) => {
              setCampaign(created);
              setStep("done");
            }}
          />
        ) : (
          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle>Creator kampaniyasi</CardTitle>
              <p className="font-body text-sm text-text-secondary">
                Bu offer uchun hozir kampaniya yaratasizmi, yoki keyinroq qo&apos;shasizmi? Bitta offerga bir nechta
                kampaniya (turli komissiya shartlari bilan) keyin ham qo&apos;shilishi mumkin.
              </p>
            </CardHeader>
            <div className="flex gap-3">
              <Button onClick={() => setShowCampaignForm(true)}>Campaign yaratish</Button>
              <Button variant="outline" onClick={() => setStep("done")}>
                Keyinroq qo&apos;shaman
              </Button>
            </div>
          </Card>
        )
      ) : null}

      {step === "done" ? (
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle>Tayyor</CardTitle>
          </CardHeader>
          <div className="flex flex-col gap-3">
            <p className="font-body text-sm text-text-secondary">
              Mahsulot, offer va landing yaratildi{campaign ? ", campaign ham yaratildi" : ""}. Har birini alohida
              tahrirlashda davom etishingiz mumkin.
            </p>
            <div className="flex flex-wrap gap-3">
              {product ? (
                <Link href={`/admin/products/${product.id}`} className="font-body text-sm text-accent underline">
                  Mahsulotni ko&apos;rish
                </Link>
              ) : null}
              {offer ? (
                <Link href={`/admin/offers/${offer.id}`} className="font-body text-sm text-accent underline">
                  Offerni ko&apos;rish
                </Link>
              ) : null}
              {offer ? (
                <Link href={`/admin/landings/${offer.id}`} className="font-body text-sm text-accent underline">
                  Landing&apos;ni tahrirlash
                </Link>
              ) : null}
              {campaign ? (
                <Link href={`/admin/campaigns/${campaign.id}`} className="font-body text-sm text-accent underline">
                  Campaignni ko&apos;rish
                </Link>
              ) : null}
            </div>
            <Button variant="outline" className="w-fit" onClick={reset}>
              Yana mahsulot yaratish
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
