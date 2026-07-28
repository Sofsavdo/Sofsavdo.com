import type { AdminOfferVariant, LandingSectionAdmin, Offer, ReferralContext } from "@rosti/types";
import { formatMoneyMinor } from "@rosti/types";
import { Button, cn } from "@rosti/ui";
import { Check, Gift, Quote, ShieldCheck, Star, Truck, Wallet } from "lucide-react";

// Every offer landing is built from these standalone, full-width sections — never the
// creator/admin shell (see DESIGN_SYSTEM.md "landing vs dashboard"). None of them link to any
// other offer/product; the only outbound actions are the CTA buttons this file renders.
// These same components serve BOTH the real buyer page (/o/[offerSlug]) and the admin landing
// builder's preview — see LandingSectionRenderer below, the single switch both call through.

export function ReferralBanner({ referral }: { referral: ReferralContext }) {
  return (
    <div className="bg-accent/10 px-pad-mobile py-2.5 text-center font-body text-sm text-accent md:px-pad-desktop">
      <strong>{referral.creatorDisplayName}</strong> tavsiyasi orqali maxsus taklif
      {referral.discountLabel ? <> — {referral.discountLabel}</> : null}
      {referral.promoCode ? (
        <>
          {" "}
          · Promo kod: <strong>{referral.promoCode}</strong>
        </>
      ) : null}
    </div>
  );
}

export function Hero({
  offer,
  selectedVariant,
  onBuyClick,
}: {
  offer: Offer;
  selectedVariant: AdminOfferVariant;
  onBuyClick: () => void;
}) {
  return (
    <section className="mx-auto max-w-page px-pad-mobile py-10 md:px-pad-desktop md:py-16">
      <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
        <div>
          <h1 className="break-words font-heading text-3xl font-bold text-text-primary md:text-4xl">{offer.headline}</h1>
          <p className="mt-4 font-body text-lg text-text-secondary">{offer.subheadline}</p>
          <div className="mt-6 flex flex-wrap items-baseline gap-3">
            <span className="font-numeric text-3xl font-bold tabular-nums text-accent">
              {formatMoneyMinor(selectedVariant.priceMinor, offer.currency)}
            </span>
            {offer.compareAtPriceMinor ? (
              <span className="font-numeric text-lg tabular-nums text-text-muted line-through">
                {formatMoneyMinor(offer.compareAtPriceMinor, offer.currency)}
              </span>
            ) : null}
          </div>
          <Button size="lg" className="mt-6 w-full md:w-auto" onClick={onBuyClick}>
            {offer.ctaLabel}
          </Button>
        </div>
        <div className="flex aspect-square items-center justify-center rounded-media bg-gradient-to-br from-accent/15 to-bg">
          <span className="font-heading text-lg text-text-muted">{offer.name}</span>
        </div>
      </div>
    </section>
  );
}

export function Problem({ text }: { text: string }) {
  return (
    <section className="mx-auto max-w-page px-pad-mobile py-8 md:px-pad-desktop">
      <h2 className="font-heading text-2xl font-bold text-text-primary">Tanish holatmi?</h2>
      <p className="mt-3 max-w-2xl font-body text-text-secondary">{text}</p>
    </section>
  );
}

export function Solution({ text }: { text: string }) {
  return (
    <section className="bg-surface px-pad-mobile py-8 md:px-pad-desktop">
      <div className="mx-auto max-w-page">
        <h2 className="font-heading text-2xl font-bold text-text-primary">Yechim</h2>
        <p className="mt-3 max-w-2xl font-body text-text-secondary">{text}</p>
      </div>
    </section>
  );
}

export function Benefits({ items, title = "Asosiy foydalar" }: { items: string[]; title?: string }) {
  return (
    <section className="mx-auto max-w-page px-pad-mobile py-8 md:px-pad-desktop">
      <h2 className="font-heading text-2xl font-bold text-text-primary">{title}</h2>
      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 font-body text-text-secondary">
            <Check className="mt-0.5 size-4 shrink-0 text-success" /> {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HowItWorks({ steps }: { steps: { step: string; text: string }[] }) {
  return (
    <section className="bg-surface px-pad-mobile py-8 md:px-pad-desktop">
      <div className="mx-auto max-w-page">
        <h2 className="font-heading text-2xl font-bold text-text-primary">Qanday ishlaydi</h2>
        <ol className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {steps.map((s) => (
            <li key={s.step} className="rounded-card border border-border bg-bg p-4">
              <span className="font-numeric text-2xl font-bold text-accent">{s.step}</span>
              <p className="mt-2 font-body text-sm text-text-secondary">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function AudienceSection({ text }: { text: string }) {
  return (
    <section className="mx-auto max-w-page px-pad-mobile py-6 md:px-pad-desktop">
      <div className="rounded-card border border-success/30 bg-success/5 p-5">
        <h3 className="font-heading text-base font-semibold text-text-primary">Kim uchun</h3>
        <p className="mt-2 font-body text-sm text-text-secondary">{text}</p>
      </div>
    </section>
  );
}

export function NotForSection({ text }: { text: string }) {
  return (
    <section className="mx-auto max-w-page px-pad-mobile py-6 md:px-pad-desktop">
      <div className="rounded-card border border-border bg-bg p-5">
        <h3 className="font-heading text-base font-semibold text-text-primary">Kim uchun emas</h3>
        <p className="mt-2 font-body text-sm text-text-secondary">{text}</p>
      </div>
    </section>
  );
}

export function CreatorVideoSection({ caption }: { caption?: string }) {
  return (
    <section className="bg-surface px-pad-mobile py-8 md:px-pad-desktop">
      <div className="mx-auto max-w-page">
        <h2 className="font-heading text-2xl font-bold text-text-primary">Creator videosi</h2>
        <div className="mt-4 flex aspect-video max-w-md items-center justify-center rounded-media bg-gradient-to-br from-dark to-text-secondary font-body text-sm text-white/70">
          Video (namuna)
        </div>
        {caption ? <p className="mt-2 max-w-md font-body text-sm text-text-secondary">{caption}</p> : null}
      </div>
    </section>
  );
}

export function Gallery({ images }: { images: string[] }) {
  return (
    <section className="bg-surface px-pad-mobile py-8 md:px-pad-desktop">
      <div className="mx-auto max-w-page">
        <h2 className="font-heading text-2xl font-bold text-text-primary">Mahsulot galereyasi</h2>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {images.map((img) => (
            <div
              key={img}
              className="flex aspect-square items-center justify-center rounded-card bg-gradient-to-br from-border to-bg font-body text-xs text-text-muted"
            >
              {img}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PricingSection({ offer }: { offer: Offer }) {
  return (
    <section className="mx-auto max-w-page px-pad-mobile py-8 text-center md:px-pad-desktop">
      <div className="flex flex-wrap items-baseline justify-center gap-3">
        <span className="font-numeric text-3xl font-bold tabular-nums text-accent">
          {formatMoneyMinor(offer.priceMinor, offer.currency)}
        </span>
        {offer.compareAtPriceMinor ? (
          <span className="font-numeric text-lg tabular-nums text-text-muted line-through">
            {formatMoneyMinor(offer.compareAtPriceMinor, offer.currency)}
          </span>
        ) : null}
      </div>
    </section>
  );
}

export function VariantPicker({
  offer,
  selectedId,
  onSelect,
}: {
  offer: Offer;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section id="variants" className="mx-auto max-w-page px-pad-mobile py-8 md:px-pad-desktop">
      <h2 className="font-heading text-2xl font-bold text-text-primary">Tarifni tanlang</h2>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {offer.variants.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v.id)}
            className={cn(
              "rounded-card border p-4 text-left transition-colors",
              v.id === selectedId ? "border-accent bg-accent/5" : "border-border bg-surface hover:border-accent/40",
            )}
          >
            <p className="font-body text-sm font-medium text-text-primary">{v.name}</p>
            <p className="mt-1 font-numeric text-lg font-semibold tabular-nums text-accent">
              {formatMoneyMinor(v.priceMinor, offer.currency)}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}

export function Reviews({ reviews }: { reviews: { author: string; rating: number; text: string }[] }) {
  return (
    <section className="bg-surface px-pad-mobile py-8 md:px-pad-desktop">
      <div className="mx-auto max-w-page">
        <h2 className="font-heading text-2xl font-bold text-text-primary">Mijozlar fikri</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {reviews.map((r) => (
            <div key={r.author} className="rounded-card border border-border bg-bg p-4">
              <Quote className="size-4 text-text-muted" />
              <p className="mt-2 font-body text-sm text-text-secondary">{r.text}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-body text-xs font-medium text-text-primary">{r.author}</span>
                <span className="flex gap-0.5">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Star key={i} className="size-3 fill-warning text-warning" />
                  ))}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Guarantee({ text }: { text: string }) {
  return (
    <section className="mx-auto max-w-page px-pad-mobile py-8 md:px-pad-desktop">
      <div className="flex items-start gap-3 rounded-card border border-success/30 bg-success/5 p-5">
        <ShieldCheck className="size-6 shrink-0 text-success" />
        <p className="font-body text-sm text-text-secondary">{text}</p>
      </div>
    </section>
  );
}

export function DeliverySection({ text }: { text: string }) {
  return (
    <section className="mx-auto max-w-page px-pad-mobile py-6 md:px-pad-desktop">
      <div className="flex items-start gap-3 rounded-card border border-border bg-bg p-5">
        <Truck className="size-5 shrink-0 text-text-secondary" />
        <p className="font-body text-sm text-text-secondary">{text}</p>
      </div>
    </section>
  );
}

export function PaymentSection({ paymentOptions }: { paymentOptions: string[] }) {
  return (
    <section className="mx-auto max-w-page px-pad-mobile py-6 md:px-pad-desktop">
      <div className="flex items-start gap-3 rounded-card border border-border bg-bg p-5">
        <Wallet className="size-5 shrink-0 text-text-secondary" />
        <p className="font-body text-sm text-text-secondary">To&apos;lov usullari: {paymentOptions.join(", ")}</p>
      </div>
    </section>
  );
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <section className="bg-surface px-pad-mobile py-8 md:px-pad-desktop">
      <div className="mx-auto max-w-page">
        <h2 className="font-heading text-2xl font-bold text-text-primary">Ko&apos;p so&apos;raladigan savollar</h2>
        <div className="mt-5 divide-y divide-border rounded-card border border-border bg-bg">
          {items.map((item) => (
            <details key={item.q} className="group p-4">
              <summary className="cursor-pointer list-none font-body text-sm font-medium text-text-primary">
                {item.q}
              </summary>
              <p className="mt-2 font-body text-sm text-text-secondary">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta({ ctaLabel, onBuyClick }: { ctaLabel: string; onBuyClick: () => void }) {
  return (
    <section className="mx-auto max-w-page px-pad-mobile py-12 text-center md:px-pad-desktop">
      <Button size="lg" onClick={onBuyClick} className="w-full sm:w-auto">
        {ctaLabel}
      </Button>
    </section>
  );
}

// Plain text only — never rendered via dangerouslySetInnerHTML, so an admin cannot inject
// arbitrary HTML/CSS/JS through this section even though it's the most "free-form" type.
export function CustomRichText({ text }: { text: string }) {
  return (
    <section className="mx-auto max-w-page whitespace-pre-wrap px-pad-mobile py-8 font-body text-text-secondary md:px-pad-desktop">
      {text}
    </section>
  );
}

export function BonusesSection({ items }: { items: string[] }) {
  return (
    <section className="bg-surface px-pad-mobile py-6 md:px-pad-desktop">
      <div className="mx-auto max-w-page">
        <div className="flex items-center gap-2">
          <Gift className="size-5 text-accent" />
          <h3 className="font-heading text-base font-semibold text-text-primary">Bonuslar</h3>
        </div>
        <ul className="mt-3 space-y-1.5">
          {items.map((item) => (
            <li key={item} className="font-body text-sm text-text-secondary">
              + {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function StickyMobileCta({
  price,
  currency,
  ctaLabel,
  onBuyClick,
}: {
  price: number;
  currency: string;
  ctaLabel: string;
  onBuyClick: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between border-t border-border bg-surface p-3 md:hidden">
      <span className="font-numeric text-lg font-semibold tabular-nums text-text-primary">
        {formatMoneyMinor(price, currency)}
      </span>
      <Button onClick={onBuyClick}>{ctaLabel}</Button>
    </div>
  );
}

// The single switch both the real buyer landing (/o/[offerSlug]) and the admin landing
// builder's preview render through — this is what "same components in preview and production"
// means concretely, rather than the admin maintaining a second look-alike renderer.
export function LandingSectionRenderer({
  offer,
  section,
  selectedVariantId,
  onSelectVariant,
  onBuyClick,
}: {
  offer: Offer;
  section: LandingSectionAdmin;
  selectedVariantId: string;
  onSelectVariant: (id: string) => void;
  onBuyClick: () => void;
}) {
  const c = section.content as Record<string, unknown>;
  const selectedVariant = offer.variants.find((v) => v.id === selectedVariantId) ?? offer.variants[0];

  switch (section.type) {
    case "HERO":
      return selectedVariant ? <Hero offer={offer} selectedVariant={selectedVariant} onBuyClick={onBuyClick} /> : null;
    case "PROBLEM":
      return <Problem text={(c.text as string) ?? ""} />;
    case "SOLUTION":
      return <Solution text={(c.text as string) ?? ""} />;
    case "BENEFITS":
      return <Benefits items={(c.items as string[]) ?? []} />;
    case "HOW_IT_WORKS":
      return <HowItWorks steps={(c.steps as { step: string; text: string }[]) ?? []} />;
    case "AUDIENCE":
      return <AudienceSection text={(c.text as string) ?? ""} />;
    case "NOT_FOR":
      return <NotForSection text={(c.text as string) ?? ""} />;
    case "CREATOR_VIDEO":
      return <CreatorVideoSection caption={c.caption as string | undefined} />;
    case "PRODUCT_GALLERY":
      return <Gallery images={(c.images as string[]) ?? []} />;
    case "PRICING":
      return <PricingSection offer={offer} />;
    case "OFFER_VARIANTS":
      return <VariantPicker offer={offer} selectedId={selectedVariantId} onSelect={onSelectVariant} />;
    case "BONUSES":
      return <BonusesSection items={(c.items as string[]) ?? offer.bonuses} />;
    case "REVIEWS":
      return <Reviews reviews={(c.reviews as { author: string; rating: number; text: string }[]) ?? []} />;
    case "GUARANTEE":
      return <Guarantee text={(c.text as string) ?? ""} />;
    case "DELIVERY":
      return <DeliverySection text={(c.text as string) ?? offer.deliveryInfo ?? ""} />;
    case "PAYMENT":
      return <PaymentSection paymentOptions={offer.paymentOptions} />;
    case "FAQ":
      return <Faq items={(c.items as { q: string; a: string }[]) ?? []} />;
    case "FINAL_CTA":
      return <FinalCta ctaLabel={offer.ctaLabel} onBuyClick={onBuyClick} />;
    case "CUSTOM_RICH_TEXT":
      return <CustomRichText text={(c.text as string) ?? ""} />;
    default:
      return null;
  }
}
