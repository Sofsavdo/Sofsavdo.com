import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CommissionsService } from "./commissions.service";
import { CommissionQueryDto } from "./dto/commission-query.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ReviewReasonDto } from "../creator-applications/dto/review-reason.dto";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@ApiTags("admin/commissions")
@ApiBearerAuth("bearer")
@Controller("admin/commissions")
export class AdminCommissionsController {
  constructor(private commissions: CommissionsService) {}

  @RequirePermissions("commission.read")
  @Get()
  list(@Query() query: CommissionQueryDto) {
    return this.commissions.list(query);
  }

  @RequirePermissions("commission.read")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.commissions.findOneOrThrow(id);
  }

  @RequirePermissions("commission.adjust")
  @Post(":id/approve")
  approve(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.commissions.approve(id, user.userId);
  }

  @RequirePermissions("commission.adjust")
  @Post(":id/reject")
  reject(@Param("id") id: string, @Body() dto: ReviewReasonDto, @CurrentUser() user: AuthenticatedUser) {
    return this.commissions.reject(id, user.userId, dto.reason);
  }

  @RequirePermissions("commission.adjust")
  @Post(":id/mark-payable")
  markPayable(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.commissions.markPayable(id, user.userId);
  }
}
