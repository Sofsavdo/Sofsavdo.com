import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PayoutsService } from "./payouts.service";
import { RequestPayoutDto } from "./dto/request-payout.dto";
import { PayoutQueryDto } from "./dto/payout-query.dto";
import { RequireCreatorGuard } from "../common/guards/require-creator.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

// Ownership-scoped by creatorId from the JWT, not RBAC-gated — same convention as Wallet.
@ApiTags("creator/payouts")
@ApiBearerAuth("bearer")
@UseGuards(RequireCreatorGuard)
@Controller("creator/payouts")
export class CreatorPayoutsController {
  constructor(private payouts: PayoutsService) {}

  @Get()
  listMine(@Query() query: PayoutQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payouts.listMine(user.creatorId!, query);
  }

  @Post()
  request(@Body() dto: RequestPayoutDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payouts.requestPayout(user.creatorId!, user.userId, dto);
  }

  @Post(":id/cancel")
  cancel(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payouts.cancel(id, user.creatorId!, user.userId);
  }
}
