import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CreatorDashboardService } from "./creator-dashboard.service";
import { RequireCreatorGuard } from "../common/guards/require-creator.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

// Same creator-facing convention as CreatorSalesController — RequireCreatorGuard (approved-creator
// check), never @RequirePermissions (this isn't staff RBAC), ownership scoped by the JWT's own
// creatorId, never a route param a creator could tamper with to read someone else's numbers.
@ApiTags("creator/dashboard")
@ApiBearerAuth("bearer")
@UseGuards(RequireCreatorGuard)
@Controller("creator/dashboard-stats")
export class CreatorDashboardController {
  constructor(private dashboard: CreatorDashboardService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getStats(user.creatorId!);
  }
}
