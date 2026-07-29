import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PromoCodesService } from "./promo-codes.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";

// Reuses referral.read rather than a new permission key — PromoCode is a sub-resource of the
// creator-referral/marketing domain, same reasoning campaign media reuses campaign.write.
@ApiTags("admin/promo-codes")
@ApiBearerAuth("bearer")
@Controller("admin/promo-codes")
export class AdminPromoCodesController {
  constructor(private promoCodes: PromoCodesService) {}

  @RequirePermissions("referral.read")
  @Get()
  list() {
    return this.promoCodes.listAdmin();
  }
}
