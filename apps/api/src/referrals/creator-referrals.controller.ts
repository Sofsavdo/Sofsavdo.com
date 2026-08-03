import { Controller, Get, Param, Put, Body, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ReferralsService } from "./referrals.service";
import { RequireCreatorGuard } from "../common/guards/require-creator.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

// Creator-owned reads only — every method scopes to the JWT's own creatorId, never a param, so
// there is no id to guess (see referrals.service.ts's findMineOrThrow for the one route that
// does take an id, still ownership-checked there).
@ApiTags("creator/referrals")
@ApiBearerAuth("bearer")
@UseGuards(RequireCreatorGuard)
@Controller("creator")
export class CreatorReferralsController {
  constructor(
    private referrals: ReferralsService,
    private config: ConfigService,
  ) {}

  @Get("referral-code")
  getCode(@CurrentUser() user: AuthenticatedUser) {
    return this.referrals.getMyReferralCode(user.creatorId!, this.config.get<string>("webAppUrl")!);
  }

  @Get("referrals/summary")
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.referrals.getMySummary(user.creatorId!, this.config.get<string>("webAppUrl")!);
  }

  @Get("referrals")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.referrals.listMine(user.creatorId!);
  }

  @Get("referrals/:id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.referrals.findMineOrThrow(id, user.creatorId!);
  }

  @Get("referral-rewards")
  listRewards(@CurrentUser() user: AuthenticatedUser) {
    return this.referrals.listMyRewards(user.creatorId!);
  }

  @Put("referral-code/custom")
  updateCustomPromoCode(@CurrentUser() user: AuthenticatedUser, @Body() body: { customPromoCode: string }) {
    return this.referrals.updateCustomPromoCode(user.creatorId!, body.customPromoCode);
  }
}
