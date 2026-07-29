import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CommissionsService } from "./commissions.service";
import { RequireCreatorGuard } from "../common/guards/require-creator.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

// Separate from CreatorWalletController — "sales" (what did I sell, to whom, for how much) is a
// distinct read model from "wallet" (ledger/balance), even though both are Commission-derived and
// live in this same module. Ownership-scoped by creatorId from the JWT, same convention as every
// other creator-facing controller (see RBAC.md).
@ApiTags("creator/sales")
@ApiBearerAuth("bearer")
@UseGuards(RequireCreatorGuard)
@Controller("creator/sales")
export class CreatorSalesController {
  constructor(private commissions: CommissionsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.commissions.listMySales(user.creatorId!);
  }
}
