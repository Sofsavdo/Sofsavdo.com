import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CreatorFundService } from "./creator-fund.service";
import { ContributeToFundDto } from "./dto/contribute-to-fund.dto";
import { RequireCreatorGuard } from "../common/guards/require-creator.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@ApiTags("creator/fund")
@ApiBearerAuth("bearer")
@UseGuards(RequireCreatorGuard)
@Controller("creator/fund")
export class CreatorFundController {
  constructor(private fund: CreatorFundService) {}

  @Get()
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.fund.getStats(user.creatorId!);
  }

  @Get("leaderboard")
  getLeaderboard(@CurrentUser() user: AuthenticatedUser) {
    return this.fund.getLeaderboard(user.creatorId!);
  }

  @Post("contribute")
  contribute(@CurrentUser() user: AuthenticatedUser, @Body() dto: ContributeToFundDto) {
    return this.fund.contribute(user.creatorId!, user.userId, dto);
  }
}
