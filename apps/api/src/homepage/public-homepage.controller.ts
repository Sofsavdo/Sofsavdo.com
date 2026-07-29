import { Controller, Get, Header } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { HomepageSectionsService } from "./homepage-sections.service";
import { Public } from "../common/decorators/public.decorator";

// Non-personalized and safe to cache briefly, same reasoning and value as Phase G's
// PublicOffersController headers — see that file's comment for the full rationale.
const PUBLIC_LIST_CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=120";

@ApiTags("public")
@Controller("homepage")
export class PublicHomepageController {
  constructor(private homepage: HomepageSectionsService) {}

  @Public()
  @Header("Cache-Control", PUBLIC_LIST_CACHE_CONTROL)
  @Get()
  list() {
    return this.homepage.listPublic();
  }
}
