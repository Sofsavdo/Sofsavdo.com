import { Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AdminReferralLinksService } from "./admin-referral-links.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";

// Reuses referral.read/referral.manage rather than new permission keys — same sub-resource
// reasoning as AdminPromoCodesController.
@ApiTags("admin/referral-links")
@ApiBearerAuth("bearer")
@Controller("admin/referral-links")
export class AdminReferralLinksController {
  constructor(private referralLinks: AdminReferralLinksService) {}

  @RequirePermissions("referral.read")
  @Get()
  list() {
    return this.referralLinks.list();
  }

  @RequirePermissions("referral.manage")
  @Post(":code/deactivate")
  deactivate(@Param("code") code: string) {
    return this.referralLinks.deactivate(code);
  }
}
