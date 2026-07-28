import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PayoutsService } from "./payouts.service";
import { PayoutQueryDto } from "./dto/payout-query.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ReviewReasonDto } from "../creator-applications/dto/review-reason.dto";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@ApiTags("admin/payouts")
@ApiBearerAuth("bearer")
@Controller("admin/payouts")
export class AdminPayoutsController {
  constructor(private payouts: PayoutsService) {}

  @RequirePermissions("payout.read")
  @Get()
  list(@Query() query: PayoutQueryDto) {
    return this.payouts.list(query);
  }

  @RequirePermissions("payout.read")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.payouts.findOneOrThrow(id);
  }

  @RequirePermissions("payout.approve")
  @Post(":id/approve")
  approve(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payouts.approve(id, user.userId);
  }

  @RequirePermissions("payout.approve")
  @Post(":id/reject")
  reject(@Param("id") id: string, @Body() dto: ReviewReasonDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payouts.reject(id, user.userId, dto.reason);
  }

  @RequirePermissions("payout.pay")
  @Post(":id/processing")
  markProcessing(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payouts.markProcessing(id, user.userId);
  }

  @RequirePermissions("payout.pay")
  @Post(":id/paid")
  markPaid(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payouts.markPaid(id, user.userId);
  }

  @RequirePermissions("payout.pay")
  @Post(":id/failed")
  markFailed(@Param("id") id: string, @Body() dto: ReviewReasonDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payouts.markFailed(id, user.userId, dto.reason);
  }
}
