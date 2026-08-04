import type { FeaturedOffer } from "@/lib/api";
import { ProductCard } from "@/components/catalog/ProductCard";

// Server-fetched by the parent page (app/page.tsx) and passed in as a prop — this is a marketing
// surface, not a dashboard, so it deliberately does NOT use a client-side useQuery like the
// Creator/Admin apps do. `offers` is already capped server-side (OffersService.listFeaturedPublic,
// FEATURED_OFFERS_LIMIT) before it ever reaches this component. Card rendering itself is shared
// with /catalog (Phase E) via ProductCard — see that component's own comment.
export function FeaturedProducts({ offers }: { offers: FeaturedOffer[] }) {
  return (
    <section id="featured-products" className="mx-auto max-w-7xl px-pad-mobile py-10 md:px-pad-desktop md:py-16">
      <h2 className="text-center font-heading text-2xl font-bold text-text-primary md:text-3xl">
        Tanlangan mahsulotlar
      </h2>
      {offers.length === 0 ? (
        <p className="mt-8 text-center font-body text-text-muted">
          Hozircha tanlangan mahsulotlar yo&apos;q — tez orada qo&apos;shiladi.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {offers.map((offer) => (
            <ProductCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </section>
  );
}
