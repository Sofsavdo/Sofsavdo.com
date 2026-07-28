import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AdminRefundsService } from "./admin-refunds.service";
import { RefundQueryDto } from "./dto/refund-query.dto";
import { ReviewReasonDto } from "./dto/review-reason.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@ApiTags("admin/refunds")
@ApiBearerAuth("bearer")
@Controller("admin/refunds")
export class AdminRefundsController {
  constructor(private refunds: AdminRefundsService) {}

  @RequirePermissions("refund.read")
  @Get()
  list(@Query() query: RefundQueryDto) {
    return this.refunds.list(query);
  }

  @RequirePermissions("refund.read")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.refunds.findOneOrThrow(id);
  }

  @RequirePermissions("refund.manage")
  @Post(":id/approve")
  approve(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.refunds.approve(id, user.userId);
  }

  @RequirePermissions("refund.manage")
  @Post(":id/reject")
  reject(@Param("id") id: string, @Body() dto: ReviewReasonDto, @CurrentUser() user: AuthenticatedUser) {
    return this.refunds.reject(id, user.userId, dto.reason);
  }
}
