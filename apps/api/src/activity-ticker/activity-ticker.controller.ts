import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ActivityTickerService } from "./activity-ticker.service";
import { RequireCreatorGuard } from "../common/guards/require-creator.guard";

// Platform-wide, not creator-scoped (see ActivityTickerService — one cache entry serves every
// viewer), so this route needs no @CurrentUser() at all — RequireCreatorGuard only gates it to
// authenticated creators, the same audience the leaderboard already exposes other creators'
// names/amounts to.
@ApiTags("creator/activity-ticker")
@ApiBearerAuth("bearer")
@UseGuards(RequireCreatorGuard)
@Controller("creator/activity-ticker")
export class ActivityTickerController {
  constructor(private ticker: ActivityTickerService) {}

  @Get()
  get() {
    return this.ticker.getFeed();
  }
}
