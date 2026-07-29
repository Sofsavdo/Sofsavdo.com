import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CommissionsService } from "./commissions.service";
import { RequireCreatorGuard } from "../common/guards/require-creator.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

// Same creator-facing convention as CreatorSalesController — ownership-scoped by the JWT's own
// creatorId, RequireCreatorGuard (not RBAC), no query params (the page filters by status
// client-side over the full, capped list — see CommissionsService.listMyCommissions).
@ApiTags("creator/commissions")
@ApiBearerAuth("bearer")
@UseGuards(RequireCreatorGuard)
@Controller("creator/commissions")
export class CreatorCommissionsController {
  constructor(private commissions: CommissionsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.commissions.listMyCommissions(user.creatorId!);
  }
}
