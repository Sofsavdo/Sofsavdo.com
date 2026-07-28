import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CommissionsService } from "./commissions.service";
import { CommissionQueryDto } from "./dto/commission-query.dto";
import { RequireCreatorGuard } from "../common/guards/require-creator.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

// Ownership-scoped by creatorId from the JWT, not RBAC-gated — same convention as Content/
// Campaign Applications (see RBAC.md).
@ApiTags("creator/wallet")
@ApiBearerAuth("bearer")
@UseGuards(RequireCreatorGuard)
@Controller("creator/wallet")
export class CreatorWalletController {
  constructor(private commissions: CommissionsService) {}

  @Get("balance")
  getBalance(@CurrentUser() user: AuthenticatedUser) {
    return this.commissions.getWalletBalance(user.creatorId!);
  }

  @Get("transactions")
  getTransactions(@Query() query: CommissionQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.commissions.listMyLedger(user.creatorId!, query);
  }
}
