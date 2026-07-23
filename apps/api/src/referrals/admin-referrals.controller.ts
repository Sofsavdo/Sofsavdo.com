import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ReferralsService } from "./referrals.service";
import { CreateReferralRuleDto } from "./dto/create-referral-rule.dto";
import { UpdateReferralRuleDto } from "./dto/update-referral-rule.dto";
import { AdminReferralQueryDto } from "./dto/admin-referral-query.dto";
import { ReasonDto } from "./dto/reason.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";

@ApiTags("admin/referrals")
@ApiBearerAuth("bearer")
@Controller("admin/creator-referrals")
export class AdminReferralsController {
  constructor(private referrals: ReferralsService) {}

  @RequirePermissions("referral.read")
  @Get()
  list(@Query() query: AdminReferralQueryDto) {
    return this.referrals.listForAdmin(query);
  }

  @RequirePermissions("referral.read")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.referrals.findOneForAdminOrThrow(id);
  }

  @RequirePermissions("referral.disqualify")
  @Post(":id/disqualify")
  disqualify(@Param("id") id: string, @Body() dto: ReasonDto) {
    return this.referrals.disqualify(id, dto.reason);
  }
}

@ApiTags("admin/referrals")
@ApiBearerAuth("bearer")
@Controller("admin/referral-rules")
export class AdminReferralRulesController {
  constructor(private referrals: ReferralsService) {}

  @RequirePermissions("referral.read")
  @Get()
  list() {
    return this.referrals.listRules();
  }

  @RequirePermissions("referral.manage")
  @Post()
  create(@Body() dto: CreateReferralRuleDto) {
    return this.referrals.createRule(dto);
  }

  @RequirePermissions("referral.manage")
  @Post(":id")
  update(@Param("id") id: string, @Body() dto: UpdateReferralRuleDto) {
    return this.referrals.updateRule(id, dto);
  }

  @RequirePermissions("referral.manage")
  @Post(":id/activate")
  activate(@Param("id") id: string) {
    return this.referrals.setRuleActive(id, true);
  }

  @RequirePermissions("referral.manage")
  @Post(":id/deactivate")
  deactivate(@Param("id") id: string) {
    return this.referrals.setRuleActive(id, false);
  }
}

@ApiTags("admin/referrals")
@ApiBearerAuth("bearer")
@Controller("admin/creator-referral-rewards")
export class AdminReferralRewardsController {
  constructor(private referrals: ReferralsService) {}

  @RequirePermissions("referral.review")
  @Post(":id/approve")
  approve(@Param("id") id: string) {
    return this.referrals.approveReward(id);
  }

  @RequirePermissions("referral.review")
  @Post(":id/reject")
  reject(@Param("id") id: string, @Body() dto: ReasonDto) {
    return this.referrals.rejectReward(id, dto.reason);
  }
}
