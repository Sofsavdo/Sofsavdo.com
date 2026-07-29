import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { LandingsService } from "./landings.service";
import { Public } from "../common/decorators/public.decorator";
import { DomainException } from "../common/errors/domain-error";

// THE ONLY public read of a single offer's FULL landing page — see API.md's Public section.
// `PublicOffersController`'s `GET /offers/featured` (homepage) and `GET /offers/catalog`
// (Phase E's real, paginated `/catalog`) are the two deliberate exceptions to "no public list" —
// see their own comments. Neither of those two list endpoints links back into this one's own
// page template, though: this endpoint here is still what a buyer actually lands on and checks
// out from, one offer at a time, reached from a featured/catalog card or a shared referral link,
// never from another offer's own landing page.
@ApiTags("public")
@Controller("offers")
export class PublicLandingController {
  constructor(private landings: LandingsService) {}

  @Public()
  @Get(":slug/public")
  async getPublic(@Param("slug") slug: string) {
    const result = await this.landings.getPublicByOfferSlug(slug);
    if (!result) throw new DomainException("NOT_FOUND", "Taklif topilmadi.");
    return result;
  }
}
