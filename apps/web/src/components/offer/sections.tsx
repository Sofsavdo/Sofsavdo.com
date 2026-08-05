import { useRef, useState } from "react";
import type { AdminOfferVariant, LandingSectionAdmin, Offer, ReferralContext } from "@sofsavdo/types";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Button, cn } from "@sofsavdo/ui";
import { Check, ChevronLeft, ChevronRight, Gift, ImageIcon, PlayCircle, Quote, ShieldCheck, Star, Truck, Wallet } from "lucide-react";

// Every offer landing is built from these standalone, full-width sections — never the
// creator/admin shell (see DESIGN_SYSTEM.md "landing vs dashboard"). None of them link to any
// other offer/product; the only outbound actions are the CTA buttons this file renders.
// These same components serve BOTH the real buyer page (/o/[offerSlug]) and the admin landing
// builder's preview — see LandingSectionRenderer below, the single switch both call through.

export function ReferralBanner({ referral }: { referral: ReferralContext }) {
  return (
    <div className="bg-accent/10 px-pad-mobile py-2 text-center font-body text-xs text-accent md:px-pad-desktop md:py-2.5 md:text-sm">
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

// A swipeable image strip (native scroll-snap — works with touch drag on mobile with zero extra
// JS) with desktop arrow buttons and dot indicators, replacing the old single static <img>. Falls
// back to a plain placeholder tile when the product has no photos at all.
function MediaCarousel({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollToIndex(i: number) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setIndex(i);
  }

  function onScroll() {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-media bg-gradient-to-br from-accent/10 to-bg">
        <ImageIcon className="size-16 text-accent/30" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex aspect-square snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-media bg-bg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((img, i) => (
          <div key={img + i} className="aspect-square w-full shrink-0 snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- storage-driver-dependent host, see ProductCard's own comment */}
            <img src={img} alt={`${name} — ${i + 1}`} className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
      {images.length > 1 ? (
        <>
          {index > 0 ? (
            <button
              type="button"
              onClick={() => scrollToIndex(index - 1)}
              aria-label="Oldingi rasm"
              className="absolute left-2 top-1/2 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-dark/50 text-white hover:bg-dark/70 md:flex"
            >
              <ChevronLeft className="size-5" />
            </button>
          ) : null}
          {index < images.length - 1 ? (
            <button
              type="button"
              onClick={() => scrollToIndex(index + 1)}
              aria-label="Keyingi rasm"
              className="absolute right-2 top-1/2 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-dark/50 text-white hover:bg-dark/70 md:flex"
            >
              <ChevronRight className="size-5" />
            </button>
          ) : null}
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {images.map((img, i) => (
              <button
                key={img + i}
                type="button"
                onClick={() => scrollToIndex(i)}
                aria-label={`${i + 1}-rasmga o'tish`}
                className={cn("size-1.5 rounded-full transition-colors", i === index ? "bg-white" : "bg-white/50")}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

// The buyer's very first (and, for a short product page, only) view: media, then name, then
// (for a physical product) the Original badge, then the full admin-authored description, then
// price, then one buy button — in exactly that reading order on mobile, where it's a single
// vertical stack; the desktop two-column layout keeps the same top-to-bottom order within the
// text column so nothing reflows out of sequence at any width.
export function Hero({
  offer,
  selectedVariant,
  productType,
  onBuyClick,
}: {
  offer: Offer;
  selectedVariant: AdminOfferVariant;
  productType?: "PHYSICAL_PRODUCT" | "DIGITAL_PRODUCT" | "SERVICE" | string;
  onBuyClick: () => void;
}) {
  return (
    <section className="mx-auto max-w-page px-pad-mobile py-6 md:px-pad-desktop md:py-12">
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 md:gap-10">
        <MediaCarousel images={offer.images} name={offer.name} />
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="break-words font-heading text-2xl font-bold text-text-primary md:text-4xl">{offer.headline}</h1>
            {productType === "PHYSICAL_PRODUCT" ? (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 font-body text-xs font-medium text-success">
                <ShieldCheck className="size-3.5" /> Original / Kafolat bilan
              </span>
            ) : null}
          </div>
          {offer.subheadline ? (
            <p className="whitespace-pre-wrap break-words font-body text-text-secondary">{offer.subheadline}</p>
          ) : null}
          {/* QuickProductLaunchForm (the only place that ever sets Offer.subheadline) writes the
              same admin-entered text into both subheadline and Product.description — showing both
              paragraphs duplicated the identical sentence on the buyer-facing page. Only render
              description when it's actually different content. */}
          {offer.description && offer.description.trim() !== offer.subheadline?.trim() ? (
            <p className="whitespace-pre-wrap break-words font-body text-sm text-text-secondary">{offer.description}</p>
          ) : null}
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-numeric text-3xl font-bold tabular-nums text-accent md:text-4xl">
              {formatMoneyMinor(selectedVariant.priceMinor, offer.currency)}
            </span>
            {offer.compareAtPriceMinor ? (
              <span className="font-numeric text-lg tabular-nums text-text-muted line-through">
                {formatMoneyMinor(offer.compareAtPriceMinor, offer.currency)}
              </span>
            ) : null}
          </div>
          <Button id="hero-buy-button" size="lg" onClick={onBuyClick} className="w-full md:w-fit">
            {offer.ctaLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}

export function Problem({ text }: { text: string }) {
  return (
    <section className="mx-auto max-w-page px-pad-mobile py-6 md:px-pad-desktop">
      <h2 className="font-heading text-xl font-bold text-text-primary">Tanish holatmi?</h2>
      <p className="mt-2 font-body text-text-secondary">{text}</p>
    </section>
  );
}

export function Solution({ text }: { text: string }) {
  return (
    <section className="bg-surface px-pad-mobile py-6 md:px-pad-desktop">
      <div className="mx-auto max-w-page">
        <h2 className="font-heading text-xl font-bold text-text-primary">Yechim</h2>
        <p className="mt-2 font-body text-text-secondary">{text}</p>
      </div>
    </section>
  );
}

export function HowItWorks({ steps }: { steps: { step: string; text: string }[] }) {
  return (
    <section className="bg-surface px-pad-mobile py-6 md:px-pad-desktop">
      <div className="mx-auto max-w-page">
        <h2 className="font-heading text-xl font-bold text-text-primary">Qanday ishlaydi</h2>
        <ol className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {steps.map((s) => (
            <li key={s.step} className="rounded-card border border-border bg-bg p-3">
              <span className="font-numeric text-xl font-bold text-accent">{s.step}</span>
              <p className="mt-1 font-body text-sm text-text-secondary">{s.text}</p>
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
      <div className="rounded-card border border-success/30 bg-success/5 p-4">
        <h3 className="font-heading text-sm font-semibold text-text-primary">Kim uchun</h3>
        <p className="mt-1 font-body text-sm text-text-secondary">{text}</p>
      </div>
    </section>
  );
}

export function NotForSection({ text }: { text: string }) {
  return (
    <section className="mx-auto max-w-page px-pad-mobile py-6 md:px-pad-desktop">
      <div className="rounded-card border border-border bg-bg p-4">
        <h3 className="font-heading text-sm font-semibold text-text-primary">Kim uchun emas</h3>
        <p className="mt-1 font-body text-sm text-text-secondary">{text}</p>
      </div>
    </section>
  );
}

export function CreatorVideoSection({ caption }: { caption?: string }) {
  return (
    <section className="bg-surface px-pad-mobile py-6 md:px-pad-desktop">
      <div className="mx-auto max-w-page">
        <h2 className="font-heading text-xl font-bold text-text-primary">Creator videosi</h2>
        <div className="mt-3 flex aspect-video max-w-md flex-col items-center justify-center gap-2 rounded-media bg-gradient-to-br from-dark to-text-secondary">
          <PlayCircle className="size-10 text-white/70" strokeWidth={1.5} />
          <span className="font-body text-sm text-white/70">Video tez orada</span>
        </div>
        {caption ? <p className="mt-2 max-w-md font-body text-sm text-text-secondary">{caption}</p> : null}
      </div>
    </section>
  );
}

export function Gallery({ images }: { images: string[] }) {
  if (images.length === 0) return null;
  return (
    <section className="bg-surface px-pad-mobile py-6 md:px-pad-desktop">
      <div className="mx-auto max-w-page">
        <h2 className="font-heading text-xl font-bold text-text-primary">Mahsulot galereyasi</h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {images.map((img) => (
            <div key={img} className="aspect-square overflow-hidden rounded-card bg-bg">
              {/* eslint-disable-next-line @next/next/no-img-element -- storage-driver-dependent host, see ProductCard's own comment */}
              <img src={img} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PricingSection({ offer }: { offer: Offer }) {
  return (
    <section className="mx-auto max-w-page px-pad-mobile py-6 text-center md:px-pad-desktop">
      <div className="flex flex-wrap items-baseline justify-center gap-3">
        <span className="font-numeric text-4xl font-bold tabular-nums text-accent">
          {formatMoneyMinor(offer.priceMinor, offer.currency)}
        </span>
        {offer.compareAtPriceMinor ? (
          <span className="font-numeric text-xl tabular-nums text-text-muted line-through">
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
    <section id="variants" className="mx-auto max-w-page px-pad-mobile py-6 md:px-pad-desktop">
      <h2 className="font-heading text-xl font-bold text-text-primary">Tarifni tanlang</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {offer.variants.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v.id)}
            className={cn(
              "rounded-card border p-3 text-left transition-colors",
              v.id === selectedId ? "border-accent bg-accent/5" : "border-border bg-surface hover:border-accent/40",
            )}
          >
            <p className="font-body text-sm font-medium text-text-primary">{v.name}</p>
            <p className="mt-1 font-numeric text-base font-semibold tabular-nums text-accent">
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
    <section className="bg-surface px-pad-mobile py-6 md:px-pad-desktop">
      <div className="mx-auto max-w-page">
        <h2 className="font-heading text-xl font-bold text-text-primary">Mijozlar fikri</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {reviews.map((r) => (
            <div key={r.author} className="rounded-card border border-border bg-bg p-3">
              <Quote className="size-4 text-text-muted" />
              <p className="mt-2 font-body text-sm text-text-secondary">{r.text}</p>
              <div className="mt-2 flex items-center justify-between">
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
    <section className="mx-auto max-w-page px-pad-mobile py-6 md:px-pad-desktop">
      <div className="flex items-start gap-3 rounded-card border border-success/30 bg-success/5 p-4">
        <ShieldCheck className="size-5 shrink-0 text-success" />
        <p className="font-body text-sm text-text-secondary">{text}</p>
      </div>
    </section>
  );
}

export function DeliverySection({ text }: { text: string }) {
  return (
    <section className="mx-auto max-w-page px-pad-mobile py-6 md:px-pad-desktop">
      <div className="flex items-start gap-3 rounded-card border border-border bg-bg p-4">
        <Truck className="size-5 shrink-0 text-text-secondary" />
        <p className="font-body text-sm text-text-secondary">{text}</p>
      </div>
    </section>
  );
}

export function PaymentSection({ paymentOptions }: { paymentOptions: string[] }) {
  return (
    <section className="mx-auto max-w-page px-pad-mobile py-6 md:px-pad-desktop">
      <div className="flex items-start gap-3 rounded-card border border-border bg-bg p-4">
        <Wallet className="size-5 shrink-0 text-text-secondary" />
        <p className="font-body text-sm text-text-secondary">To&apos;lov usullari: {paymentOptions.join(", ")}</p>
      </div>
    </section>
  );
}

export function FinalCta({ ctaLabel, onBuyClick }: { ctaLabel: string; onBuyClick: () => void }) {
  return (
    <section className="mx-auto max-w-page px-pad-mobile py-10 text-center md:px-pad-desktop">
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
    <section className="mx-auto max-w-page whitespace-pre-wrap px-pad-mobile py-6 font-body text-text-secondary md:px-pad-desktop">
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
  productType,
}: {
  offer: Offer;
  section: LandingSectionAdmin;
  selectedVariantId: string;
  onSelectVariant: (id: string) => void;
  onBuyClick: () => void;
  productType?: string;
}) {
  const c = section.content as Record<string, unknown>;
  const selectedVariant = offer.variants.find((v) => v.id === selectedVariantId) ?? offer.variants[0];

  switch (section.type) {
    case "HERO":
      return selectedVariant ? (
        <Hero offer={offer} selectedVariant={selectedVariant} productType={productType} onBuyClick={onBuyClick} />
      ) : null;
    case "PROBLEM":
      return <Problem text={(c.text as string) ?? ""} />;
    case "SOLUTION":
      return <Solution text={(c.text as string) ?? ""} />;
    case "HOW_IT_WORKS":
      return <HowItWorks steps={(c.steps as { step: string; text: string }[]) ?? []} />;
    case "AUDIENCE":
      return <AudienceSection text={(c.text as string) ?? ""} />;
    case "NOT_FOR":
      return <NotForSection text={(c.text as string) ?? ""} />;
    case "CREATOR_VIDEO":
      return <CreatorVideoSection caption={c.caption as string | undefined} />;
    case "PRODUCT_GALLERY": {
      const customImages = c.images as string[] | undefined;
      return <Gallery images={customImages && customImages.length > 0 ? customImages : offer.images} />;
    }
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
      // Payment is deliberately not mentioned on the buyer-facing landing page right now (COD by
      // default, no online-payment promise) — suppressed regardless of what an admin configured
      // on older landing pages, rather than deleting their section data.
      return null;
    case "FINAL_CTA":
      return <FinalCta ctaLabel={offer.ctaLabel} onBuyClick={onBuyClick} />;
    case "CUSTOM_RICH_TEXT":
      return <CustomRichText text={(c.text as string) ?? ""} />;
    default:
      return null;
  }
}
