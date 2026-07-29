import { Controller, Get, Header, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { OffersService } from "./offers.service";
import { CatalogQueryDto } from "./dto/catalog-query.dto";
import { Public } from "../common/decorators/public.decorator";

// Two public list-shaped reads this API exposes (see PublicLandingController's comment for the
// single-offer read, never a list). `featured` stays curated/capped for the homepage; `catalog`
// is the real, paginated browse surface Phase E's docs/PROHIBITED.md update allows — still no
// search field, still server-clamped page size (see CatalogQueryDto/CATALOG_MAX_PAGE_SIZE).
//
// Phase G: both routes are safe to cache briefly — neither reads a cookie or varies by caller,
// and a short TTL bounds how stale an admin's isFeatured/activate/price change can appear without
// needing any cache-invalidation logic. `stale-while-revalidate` means a cache hit never blocks on
// a slow origin fetch; the first request past max-age just triggers a background revalidation.
// No CDN/reverse-proxy sits in front of this API yet — this header is honest advance preparation
// for one, and also benefits any client (browser, future mobile app) that respects it directly.
const PUBLIC_LIST_CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=120";

@ApiTags("public")
@Controller("offers")
export class PublicOffersController {
  constructor(private offers: OffersService) {}

  @Public()
  @Header("Cache-Control", PUBLIC_LIST_CACHE_CONTROL)
  @Get("featured")
  listFeatured() {
    return this.offers.listFeaturedPublic();
  }

  @Public()
  @Header("Cache-Control", PUBLIC_LIST_CACHE_CONTROL)
  @Get("catalog")
  listCatalog(@Query() query: CatalogQueryDto) {
    return this.offers.listCatalog(query);
  }
}
