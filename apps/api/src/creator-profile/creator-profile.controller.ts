import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CreatorProfileService } from "./creator-profile.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { DomainException } from "../common/errors/domain-error";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

// Deliberately NOT gated by RequireCreatorGuard — that guard requires an *approved* onboarding
// application, but this endpoint is exactly how the frontend discovers whether the application
// is approved yet (a not-yet-approved creator must still be able to read their own status).
@ApiTags("creator/profile")
@ApiBearerAuth("bearer")
@Controller("creator/profile")
export class CreatorProfileController {
  constructor(private profile: CreatorProfileService) {}

  @Get()
  getMine(@CurrentUser() user: AuthenticatedUser) {
    if (!user.creatorId) throw new DomainException("FORBIDDEN", "Bu endpoint faqat creatorlar uchun.");
    return this.profile.getMine(user.creatorId);
  }
}
