import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { LandingsService } from "./landings.service";
import { Public } from "../common/decorators/public.decorator";
import { DomainException } from "../common/errors/domain-error";

// THE ONLY public read of an offer/landing — see API.md's Public section. No list endpoint
// exists here or anywhere else in this API; a buyer can only ever land on the one page their
// link points to.
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
