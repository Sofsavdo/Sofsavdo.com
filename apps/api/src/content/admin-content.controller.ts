import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ContentService } from "./content.service";
import { ContentQueryDto } from "./dto/content-query.dto";
import { ReviewCommentDto } from "./dto/review-comment.dto";
import { ReviewReasonDto } from "../creator-applications/dto/review-reason.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@ApiTags("admin/content")
@ApiBearerAuth("bearer")
@Controller("admin/contents")
export class AdminContentController {
  constructor(private content: ContentService) {}

  @RequirePermissions("content.read")
  @Get()
  list(@Query() query: ContentQueryDto) {
    return this.content.list(query);
  }

  @RequirePermissions("content.read")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.content.findOneOrThrow(id);
  }

  @RequirePermissions("content.review")
  @Post(":id/start-review")
  startReview(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.content.startReview(id, user.userId);
  }

  @RequirePermissions("content.approve")
  @Post(":id/approve")
  approve(@Param("id") id: string, @Body() dto: ReviewCommentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.content.approve(id, user.userId, dto.comment);
  }

  @RequirePermissions("content.reject")
  @Post(":id/reject")
  reject(@Param("id") id: string, @Body() dto: ReviewReasonDto, @CurrentUser() user: AuthenticatedUser) {
    return this.content.reject(id, user.userId, dto.reason);
  }

  @RequirePermissions("content.revise")
  @Post(":id/request-changes")
  requestChanges(@Param("id") id: string, @Body() dto: ReviewReasonDto, @CurrentUser() user: AuthenticatedUser) {
    return this.content.requestChanges(id, user.userId, dto.reason);
  }
}
