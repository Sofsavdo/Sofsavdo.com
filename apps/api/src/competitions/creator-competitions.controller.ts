import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CompetitionsService } from "./competitions.service";
import { RequireCreatorGuard } from "../common/guards/require-creator.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

// Same creator-facing convention as CreatorSalesController/CreatorDashboardController —
// RequireCreatorGuard, no @RequirePermissions (not staff RBAC), ownership scoped by the JWT.
@ApiTags("creator/competitions")
@ApiBearerAuth("bearer")
@UseGuards(RequireCreatorGuard)
@Controller("creator/competitions")
export class CreatorCompetitionsController {
  constructor(private competitions: CompetitionsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.competitions.listActiveForCreators(user.creatorId ?? undefined);
  }

  @Get(":id/leaderboard")
  leaderboard(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.competitions.getLeaderboard(id, user.creatorId!);
  }

  @Post(":id/join")
  join(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.competitions.join(id, user.creatorId!);
  }
}
