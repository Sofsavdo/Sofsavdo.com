import { Controller, Get, Header } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PublicActivityService } from "./public-activity.service";
import { Public } from "../common/decorators/public.decorator";

// Short cache — same reasoning as PublicHomepageController's own header, just a shorter window to
// match this feed's "feels live" purpose (see PublicActivityService's own TTL comment).
const PUBLIC_ACTIVITY_CACHE_CONTROL = "public, max-age=15, stale-while-revalidate=60";

@ApiTags("public")
@Controller("public/recent-activity")
export class PublicActivityController {
  constructor(private activity: PublicActivityService) {}

  @Public()
  @Header("Cache-Control", PUBLIC_ACTIVITY_CACHE_CONTROL)
  @Get()
  get() {
    return this.activity.getRecentActivity();
  }
}
