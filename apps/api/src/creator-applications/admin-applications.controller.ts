import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CreatorApplicationsService } from "./creator-applications.service";
import { ApplicationQueryDto } from "./dto/application-query.dto";
import { ReviewReasonDto } from "./dto/review-reason.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@ApiTags("admin/creator-applications")
@ApiBearerAuth("bearer")
@Controller("admin/creator-applications")
export class AdminApplicationsController {
  constructor(private applications: CreatorApplicationsService) {}

  @RequirePermissions("application.read")
  @Get()
  list(@Query() query: ApplicationQueryDto) {
    return this.applications.list(query);
  }

  @RequirePermissions("application.read")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.applications.findOneOrThrow(id);
  }

  @RequirePermissions("application.review")
  @Post(":id/start-review")
  startReview(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.startReview(id, user.userId);
  }

  @RequirePermissions("application.approve")
  @Post(":id/approve")
  approve(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.approve(id, user.userId);
  }

  @RequirePermissions("application.reject")
  @Post(":id/reject")
  reject(@Param("id") id: string, @Body() dto: ReviewReasonDto, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.reject(id, user.userId, dto.reason);
  }

  @RequirePermissions("application.revise")
  @Post(":id/request-changes")
  requestChanges(@Param("id") id: string, @Body() dto: ReviewReasonDto, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.requestChanges(id, user.userId, dto.reason);
  }
}
