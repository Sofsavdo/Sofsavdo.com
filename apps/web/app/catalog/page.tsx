import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@sofsavdo/config/brand";
import { getCatalog } from "@/lib/api";
import { ProductCard } from "@/components/catalog/ProductCard";
import { PublicHeader } from "@/components/home/PublicHeader";
import { Footer } from "@/components/home/Footer";

export const metadata: Metadata = {
  title: `Katalog — ${BRAND.name}`,
  description: `${BRAND.name}'ning barcha mahsulotlari — turi va narxi bo'yicha filtrlang.`,
};

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  PHYSICAL_PRODUCT: "Fizik mahsulot",
  DIGITAL_PRODUCT: "Raqamli mahsulot",
  COURSE: "Kurs",
  SERVICE: "Xizmat",
  CONSULTATION: "Konsultatsiya",
};

interface CatalogSearchParams {
  page?: string;
  type?: string;
  minPrice?: string;
  maxPrice?: string;
}

// A real, paginated browse surface (Phase E) — the one thing docs/PROHIBITED.md explicitly kept
// banning even after Phase C's curated homepage landed. Deliberately still no search box (see
// CatalogQueryDto's own comment) — only type/price filtering, via a plain server-rendered GET
// form so filtering is a full navigation, not client-side state — this page stays a genuine
// Server Component with zero client JS, matching the homepage's own "Server Components preferred"
// precedent.
export default async function CatalogPage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;
  const minPriceMinor = params.minPrice ? Math.round(Number(params.minPrice) * 100) : undefined;
  const maxPriceMinor = params.maxPrice ? Math.round(Number(params.maxPrice) * 100) : undefined;

  const catalog = await getCatalog({ page, type: params.type, minPriceMinor, maxPriceMinor }).catch(() => ({
    items: [],
    page: 1,
    pageSize: 0,
    total: 0,
    totalPages: 1,
  }));

  function pageHref(targetPage: number): string {
    const qs = new URLSearchParams();
    if (params.type) qs.set("type", params.type);
    if (params.minPrice) qs.set("minPrice", params.minPrice);
    if (params.maxPrice) qs.set("maxPrice", params.maxPrice);
    qs.set("page", String(targetPage));
    return `/catalog?${qs.toString()}`;
  }

  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-7xl px-pad-mobile py-10 md:px-pad-desktop md:py-16">
      <h1 className="font-heading text-3xl font-bold text-text-primary">Katalog</h1>
      <p className="mt-2 font-body text-text-secondary">Barcha mahsulotlar — turi va narxi bo&apos;yicha filtrlang.</p>

      <form method="GET" className="mt-6 flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="type" className="font-body text-xs text-text-secondary">
            Turi
          </label>
          <select
            id="type"
            name="type"
            defaultValue={params.type ?? ""}
            className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
          >
            <option value="">Barchasi</option>
            {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="minPrice" className="font-body text-xs text-text-secondary">
            Min narx (so&apos;m)
          </label>
          <input
            id="minPrice"
            name="minPrice"
            type="number"
            defaultValue={params.minPrice}
            className="h-10 w-32 rounded-input border border-border bg-bg px-3 font-body text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="maxPrice" className="font-body text-xs text-text-secondary">
            Max narx (so&apos;m)
          </label>
          <input
            id="maxPrice"
            name="maxPrice"
            type="number"
            defaultValue={params.maxPrice}
            className="h-10 w-32 rounded-input border border-border bg-bg px-3 font-body text-sm"
          />
        </div>
        <button type="submit" className="h-10 rounded-button bg-accent px-4 font-body text-sm font-medium text-white hover:bg-accent-hover">
          Filtrlash
        </button>
        {params.type || params.minPrice || params.maxPrice ? (
          <Link href="/catalog" className="font-body text-sm text-text-secondary underline">
            Filtrni tozalash
          </Link>
        ) : null}
      </form>

      {catalog.items.length === 0 ? (
        <p className="mt-10 text-center font-body text-text-muted">Mahsulotlar topilmadi.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {catalog.items.map((offer) => (
            <ProductCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}

      {catalog.totalPages > 1 ? (
        <div className="mt-8 flex items-center justify-center gap-4">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="font-body text-sm text-accent underline">
              Oldingi
            </Link>
          ) : null}
          <span className="font-body text-sm text-text-muted">
            {catalog.page} / {catalog.totalPages}
          </span>
          {page < catalog.totalPages ? (
            <Link href={pageHref(page + 1)} className="font-body text-sm text-accent underline">
              Keyingi
            </Link>
          ) : null}
        </div>
      ) : null}
      </main>
      <Footer />
    </>
  );
}
