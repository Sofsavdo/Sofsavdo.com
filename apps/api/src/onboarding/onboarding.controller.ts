import { Body, Controller, Get, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { OnboardingService } from "./onboarding.service";
import { UpdateOnboardingDto } from "./dto/update-onboarding.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { DomainException } from "../common/errors/domain-error";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

// Deliberately NOT gated by RequireCreatorGuard — that guard requires an *approved* application,
// which is exactly what every route here exists to work towards. Ownership is the creatorId off
// the JWT, same pattern as CreatorProfileController. See RBAC.md's Phase 11 note and
// DECISIONS.md ADR-018.
@ApiTags("creator/onboarding")
@ApiBearerAuth("bearer")
@Controller("creator/onboarding")
export class OnboardingController {
  constructor(private onboarding: OnboardingService) {}

  private requireCreatorId(user: AuthenticatedUser): string {
    if (!user.creatorId) throw new DomainException("FORBIDDEN", "Bu endpoint faqat creatorlar uchun.");
    return user.creatorId;
  }

  @Get()
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.getMine(this.requireCreatorId(user));
  }

  @Patch()
  updateDraft(@Body() dto: UpdateOnboardingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.updateDraft(this.requireCreatorId(user), dto);
  }

  @Post("submit")
  submit(@CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.submit(this.requireCreatorId(user));
  }

  @Post("resubmit")
  resubmit(@CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.resubmit(this.requireCreatorId(user));
  }
}
