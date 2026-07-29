import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CreatorLeaderboardService } from "./creator-leaderboard.service";
import { RequireCreatorGuard } from "../common/guards/require-creator.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@ApiTags("creator/leaderboard")
@ApiBearerAuth("bearer")
@UseGuards(RequireCreatorGuard)
@Controller("creator/leaderboard")
export class CreatorLeaderboardController {
  constructor(private leaderboard: CreatorLeaderboardService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.leaderboard.getLeaderboard(user.creatorId!);
  }
}
