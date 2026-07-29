"use client";

import { useState } from "react";
import { Button, TextAreaField, TextField } from "@sofsavdo/ui";
import { Plus, Trash2 } from "lucide-react";
import type { HomepageSectionAdmin } from "@/lib/api/admin";
import { HOMEPAGE_SECTION_HAS_EDITOR } from "./homepageSectionTypeConfig";

type IconLabelItem = { icon: string; label: string };
type Reason = { icon: string; title: string; body: string };
type FaqItem = { question: string; answer: string };

// Unlike the Landing domain's SectionEditor (one generic shape dispatched from a single-field
// content map), each Homepage section type has several distinct named fields — see each home
// component's own *Content interface (Hero.tsx, BenefitsGrid.tsx, etc.). A per-type switch here is
// more honest than force-fitting multi-field content into the Landing editor's generic
// text/items/steps/faq shapes, and there are only 8 real editable types to cover.
export function HomepageSectionEditor({
  section,
  onSave,
  isPending,
}: {
  section: HomepageSectionAdmin;
  onSave: (content: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const c = section.content;

  const [heroTitle, setHeroTitle] = useState((c.title as string) ?? "");
  const [heroSubtitle, setHeroSubtitle] = useState((c.subtitle as string) ?? "");
  const [heroCtaLabel, setHeroCtaLabel] = useState((c.ctaLabel as string) ?? "");
  const [heroCtaHref, setHeroCtaHref] = useState((c.ctaHref as string) ?? "");

  const [whyHeading, setWhyHeading] = useState((c.heading as string) ?? "");
  const [reasons, setReasons] = useState<Reason[]>((c.reasons as Reason[]) ?? [{ icon: "BadgeCheck", title: "", body: "" }]);

  const [bannerTitle, setBannerTitle] = useState((c.title as string) ?? "");
  const [bannerBody, setBannerBody] = useState((c.body as string) ?? "");
  const [bannerCtaLabel, setBannerCtaLabel] = useState((c.ctaLabel as string) ?? "");
  const [bannerCtaHref, setBannerCtaHref] = useState((c.ctaHref as string) ?? "");

  const [creatorHeading, setCreatorHeading] = useState((c.heading as string) ?? "");
  const [creatorBody, setCreatorBody] = useState((c.body as string) ?? "");
  const [primaryCtaLabel, setPrimaryCtaLabel] = useState((c.primaryCtaLabel as string) ?? "");
  const [primaryCtaHref, setPrimaryCtaHref] = useState((c.primaryCtaHref as string) ?? "");
  const [secondaryCtaLabel, setSecondaryCtaLabel] = useState((c.secondaryCtaLabel as string) ?? "");
  const [secondaryCtaHref, setSecondaryCtaHref] = useState((c.secondaryCtaHref as string) ?? "");

  const [benefitItems, setBenefitItems] = useState<IconLabelItem[]>((c.items as IconLabelItem[]) ?? [{ icon: "CreditCard", label: "" }]);

  const [faqHeading, setFaqHeading] = useState((c.heading as string) ?? "");
  const [faqItems, setFaqItems] = useState<FaqItem[]>((c.items as FaqItem[]) ?? [{ question: "", answer: "" }]);

  const [supportHeading, setSupportHeading] = useState((c.heading as string) ?? "");
  const [supportBody, setSupportBody] = useState((c.body as string) ?? "");

  const [richText, setRichText] = useState((c.text as string) ?? "");

  if (!HOMEPAGE_SECTION_HAS_EDITOR[section.type]) {
    return (
      <p className="font-body text-sm text-text-muted">
        {section.type === "FEATURED_PRODUCTS"
          ? "Bu section avtomatik ravishda tanlangan (featured) offerlarni ko'rsatadi — mazmuni bu yerda tahrirlanmaydi."
          : "Bu section hali qurilmagan (Category modeli mavjud emas) — faqat joy egallash uchun."}
      </p>
    );
  }

  function save() {
    switch (section.type) {
      case "HERO":
        return onSave({ title: heroTitle, subtitle: heroSubtitle, ctaLabel: heroCtaLabel, ctaHref: heroCtaHref });
      case "WHY_SOFSAVDO":
        return onSave({ heading: whyHeading, reasons });
      case "BANNER":
        return onSave({ title: bannerTitle, body: bannerBody, ctaLabel: bannerCtaLabel, ctaHref: bannerCtaHref });
      case "CREATOR_PROGRAM_BLURB":
        return onSave({
          heading: creatorHeading,
          body: creatorBody,
          primaryCtaLabel,
          primaryCtaHref,
          secondaryCtaLabel,
          secondaryCtaHref,
        });
      case "BENEFITS":
        return onSave({ items: benefitItems });
      case "FAQ":
        return onSave({ heading: faqHeading, items: faqItems });
      case "SUPPORT":
        return onSave({ heading: supportHeading, body: supportBody });
      case "CUSTOM_RICH_TEXT":
        return onSave({ text: richText });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {section.type === "HERO" ? (
        <>
          <TextField label="Sarlavha" value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} placeholder="Sofsavdo" />
          <TextAreaField label="Subtitle" value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} />
          <TextField label="CTA matni" value={heroCtaLabel} onChange={(e) => setHeroCtaLabel(e.target.value)} placeholder="Mahsulotlarni ko'rish" />
          <TextField label="CTA havolasi" value={heroCtaHref} onChange={(e) => setHeroCtaHref(e.target.value)} placeholder="#featured-products yoki /catalog" />
        </>
      ) : null}

      {section.type === "WHY_SOFSAVDO" ? (
        <>
          <TextField label="Sarlavha" value={whyHeading} onChange={(e) => setWhyHeading(e.target.value)} placeholder="Nega Sofsavdo?" />
          <div className="flex flex-col gap-2">
            {reasons.map((r, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-input border border-border p-3">
                <input
                  value={r.icon}
                  onChange={(e) => setReasons((list) => list.map((x, idx) => (idx === i ? { ...x, icon: e.target.value } : x)))}
                  className="h-9 rounded-input border border-border bg-surface px-3 font-body text-sm"
                  placeholder="Icon (BadgeCheck / ShieldCheck / Truck / CreditCard / PackageCheck / RotateCcw / Headset)"
                />
                <input
                  value={r.title}
                  onChange={(e) => setReasons((list) => list.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)))}
                  className="h-9 rounded-input border border-border bg-surface px-3 font-body text-sm"
                  placeholder="Sarlavha"
                />
                <textarea
                  value={r.body}
                  onChange={(e) => setReasons((list) => list.map((x, idx) => (idx === i ? { ...x, body: e.target.value } : x)))}
                  className="min-h-16 rounded-input border border-border bg-surface px-3 py-2 font-body text-sm"
                  placeholder="Matn"
                />
                <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setReasons((list) => list.filter((_, idx) => idx !== i))}>
                  <Trash2 className="mr-1.5 size-4 text-error" /> O&apos;chirish
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setReasons((list) => [...list, { icon: "BadgeCheck", title: "", body: "" }])}>
              <Plus className="mr-1.5 size-4" /> Sabab qo&apos;shish
            </Button>
          </div>
        </>
      ) : null}

      {section.type === "BANNER" ? (
        <>
          <TextField label="Sarlavha" value={bannerTitle} onChange={(e) => setBannerTitle(e.target.value)} />
          <TextAreaField label="Matn" value={bannerBody} onChange={(e) => setBannerBody(e.target.value)} />
          <TextField label="CTA matni" value={bannerCtaLabel} onChange={(e) => setBannerCtaLabel(e.target.value)} />
          <TextField label="CTA havolasi" value={bannerCtaHref} onChange={(e) => setBannerCtaHref(e.target.value)} />
        </>
      ) : null}

      {section.type === "CREATOR_PROGRAM_BLURB" ? (
        <>
          <TextField label="Sarlavha" value={creatorHeading} onChange={(e) => setCreatorHeading(e.target.value)} />
          <TextAreaField label="Matn" value={creatorBody} onChange={(e) => setCreatorBody(e.target.value)} />
          <TextField label="Asosiy CTA matni" value={primaryCtaLabel} onChange={(e) => setPrimaryCtaLabel(e.target.value)} />
          <TextField label="Asosiy CTA havolasi" value={primaryCtaHref} onChange={(e) => setPrimaryCtaHref(e.target.value)} />
          <TextField label="Ikkinchi CTA matni" value={secondaryCtaLabel} onChange={(e) => setSecondaryCtaLabel(e.target.value)} />
          <TextField label="Ikkinchi CTA havolasi" value={secondaryCtaHref} onChange={(e) => setSecondaryCtaHref(e.target.value)} />
        </>
      ) : null}

      {section.type === "BENEFITS" ? (
        <div className="flex flex-col gap-2">
          {benefitItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={item.icon}
                onChange={(e) => setBenefitItems((list) => list.map((x, idx) => (idx === i ? { ...x, icon: e.target.value } : x)))}
                className="h-9 w-40 rounded-input border border-border bg-surface px-2 font-body text-sm"
                placeholder="Icon"
              />
              <input
                value={item.label}
                onChange={(e) => setBenefitItems((list) => list.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
                className="h-9 flex-1 rounded-input border border-border bg-surface px-3 font-body text-sm"
                placeholder="Label"
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => setBenefitItems((list) => list.filter((_, idx) => idx !== i))}>
                <Trash2 className="size-4 text-error" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setBenefitItems((list) => [...list, { icon: "CreditCard", label: "" }])}>
            <Plus className="mr-1.5 size-4" /> Qo&apos;shish
          </Button>
        </div>
      ) : null}

      {section.type === "FAQ" ? (
        <>
          <TextField label="Sarlavha" value={faqHeading} onChange={(e) => setFaqHeading(e.target.value)} />
          <div className="flex flex-col gap-2">
            {faqItems.map((f, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-input border border-border p-3">
                <input
                  value={f.question}
                  onChange={(e) => setFaqItems((list) => list.map((x, idx) => (idx === i ? { ...x, question: e.target.value } : x)))}
                  className="h-9 rounded-input border border-border bg-surface px-3 font-body text-sm"
                  placeholder="Savol"
                />
                <textarea
                  value={f.answer}
                  onChange={(e) => setFaqItems((list) => list.map((x, idx) => (idx === i ? { ...x, answer: e.target.value } : x)))}
                  className="min-h-14 rounded-input border border-border bg-surface px-3 py-2 font-body text-sm"
                  placeholder="Javob"
                />
                <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setFaqItems((list) => list.filter((_, idx) => idx !== i))}>
                  <Trash2 className="mr-1.5 size-4 text-error" /> O&apos;chirish
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setFaqItems((list) => [...list, { question: "", answer: "" }])}>
              <Plus className="mr-1.5 size-4" /> Savol qo&apos;shish
            </Button>
          </div>
        </>
      ) : null}

      {section.type === "SUPPORT" ? (
        <>
          <TextField label="Sarlavha" value={supportHeading} onChange={(e) => setSupportHeading(e.target.value)} />
          <TextAreaField label="Matn" value={supportBody} onChange={(e) => setSupportBody(e.target.value)} />
        </>
      ) : null}

      {section.type === "CUSTOM_RICH_TEXT" ? <TextAreaField label="Matn" value={richText} onChange={(e) => setRichText(e.target.value)} /> : null}

      <Button type="button" size="sm" className="w-fit" onClick={save} disabled={isPending}>
        {isPending ? "Saqlanmoqda..." : "Saqlash"}
      </Button>
    </div>
  );
}
