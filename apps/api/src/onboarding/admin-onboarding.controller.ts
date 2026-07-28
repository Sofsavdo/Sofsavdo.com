import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { OnboardingService } from "./onboarding.service";
import { OnboardingQueryDto } from "./dto/onboarding-query.dto";
import { ReviewReasonDto } from "./dto/review-reason.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

// "creator-onboarding" — distinct route prefix from admin/creator-applications (CampaignApplication
// review, see admin-applications.controller.ts / ADR-012). This is the onboarding admission
// decision (may this person be a creator on the platform at all), not a per-campaign one.
@ApiTags("admin/creator-onboarding")
@ApiBearerAuth("bearer")
@Controller("admin/creator-onboarding")
export class AdminOnboardingController {
  constructor(private onboarding: OnboardingService) {}

  @RequirePermissions("onboarding.read")
  @Get()
  list(@Query() query: OnboardingQueryDto) {
    return this.onboarding.list(query);
  }

  @RequirePermissions("onboarding.read")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.onboarding.findOneOrThrow(id);
  }

  @RequirePermissions("onboarding.read")
  @Get(":id/audit")
  getAuditTrail(@Param("id") id: string) {
    return this.onboarding.getAuditTrail(id);
  }

  @RequirePermissions("onboarding.review")
  @Post(":id/start-review")
  startReview(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.startReview(id, user.userId);
  }

  @RequirePermissions("onboarding.approve")
  @Post(":id/approve")
  approve(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.approve(id, user.userId);
  }

  @RequirePermissions("onboarding.reject")
  @Post(":id/reject")
  reject(@Param("id") id: string, @Body() dto: ReviewReasonDto, @CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.reject(id, user.userId, dto.reason);
  }

  @RequirePermissions("onboarding.revise")
  @Post(":id/request-changes")
  requestChanges(@Param("id") id: string, @Body() dto: ReviewReasonDto, @CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.requestChanges(id, user.userId, dto.reason);
  }
}
