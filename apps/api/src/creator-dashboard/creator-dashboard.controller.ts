import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CreatorDashboardService } from "./creator-dashboard.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { DomainException } from "../common/errors/domain-error";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

// Deliberately NOT gated by RequireCreatorGuard (which requires an *approved* application) — same
// reasoning as CreatorProfileController/CreatorNotificationsController: a creator whose application
// is still SUBMITTED/UNDER_REVIEW must still be able to see their own cabinet (with real, if mostly
// zero, numbers) rather than being bounced back to a bare onboarding-status page. Ownership is
// enforced by scoping every query to the JWT's own creatorId, same as those two controllers.
@ApiTags("creator/dashboard")
@ApiBearerAuth("bearer")
@Controller("creator/dashboard-stats")
export class CreatorDashboardController {
  constructor(private dashboard: CreatorDashboardService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    if (!user.creatorId) throw new DomainException("FORBIDDEN", "Bu endpoint faqat creatorlar uchun.");
    return this.dashboard.getStats(user.creatorId);
  }
}
