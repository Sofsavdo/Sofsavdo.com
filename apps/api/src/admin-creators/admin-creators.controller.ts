import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AdminCreatorsService } from "./admin-creators.service";
import { CreatorQueryDto } from "./dto/creator-query.dto";
import { AccountActionDto } from "./dto/account-action.dto";
import { SetBioComplianceDto } from "./dto/set-bio-compliance.dto";
import { SetTierDto } from "./dto/set-tier.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@ApiTags("admin/creators")
@ApiBearerAuth("bearer")
@Controller("admin/creators")
export class AdminCreatorsController {
  constructor(private creators: AdminCreatorsService) {}

  @RequirePermissions("creator.read")
  @Get()
  list(@Query() query: CreatorQueryDto) {
    return this.creators.list(query);
  }

  @RequirePermissions("creator.review")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.creators.findOneOrThrow(id);
  }

  @RequirePermissions("creator.review")
  @Get(":id/campaign-history")
  campaignHistory(@Param("id") id: string) {
    return this.creators.getCampaignHistory(id);
  }

  @RequirePermissions("creator.review")
  @Get(":id/earnings-summary")
  earningsSummary(@Param("id") id: string) {
    return this.creators.getEarningsSummary(id);
  }

  @RequirePermissions("creator.review")
  @Get(":id/payout-summary")
  payoutSummary(@Param("id") id: string) {
    return this.creators.getPayoutSummary(id);
  }

  @RequirePermissions("creator.review")
  @Get(":id/referral-summary")
  referralSummary(@Param("id") id: string) {
    return this.creators.getReferralSummary(id);
  }

  @RequirePermissions("creator.suspend")
  @Post(":id/suspend")
  suspend(@Param("id") id: string, @Body() dto: AccountActionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.creators.suspend(id, user.userId, dto.reason);
  }

  @RequirePermissions("creator.suspend")
  @Post(":id/unsuspend")
  unsuspend(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.creators.unsuspend(id, user.userId);
  }

  @RequirePermissions("creator.block")
  @Post(":id/block")
  block(@Param("id") id: string, @Body() dto: AccountActionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.creators.block(id, user.userId, dto.reason);
  }

  @RequirePermissions("creator.block")
  @Post(":id/unblock")
  unblock(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.creators.unblock(id, user.userId);
  }

  @RequirePermissions("creator.compliance")
  @Patch(":id/bio-compliance")
  setBioCompliance(@Param("id") id: string, @Body() dto: SetBioComplianceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.creators.setBioCompliance(id, dto.status, user.userId);
  }

  @RequirePermissions("creator.tier")
  @Patch(":id/tier")
  setTier(@Param("id") id: string, @Body() dto: SetTierDto, @CurrentUser() user: AuthenticatedUser) {
    return this.creators.setTier(id, dto.tier, user.userId);
  }
}
