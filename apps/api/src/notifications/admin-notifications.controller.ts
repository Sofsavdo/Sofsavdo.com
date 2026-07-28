import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { AdminNotificationQueryDto } from "./dto/admin-notification-query.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@ApiTags("admin/notifications")
@ApiBearerAuth("bearer")
@Controller("admin/notifications")
export class AdminNotificationsController {
  constructor(private notifications: NotificationsService) {}

  @RequirePermissions("notification.read")
  @Get()
  list(@Query() query: AdminNotificationQueryDto) {
    return this.notifications.adminList(query);
  }

  @RequirePermissions("notification.read")
  @Get("failed")
  listFailed(@Query() query: AdminNotificationQueryDto) {
    query.status = "FAILED";
    return this.notifications.adminList(query);
  }

  @RequirePermissions("notification.read")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.notifications.adminFindOneOrThrow(id);
  }

  @RequirePermissions("notification.manage")
  @Post(":id/retry")
  retry(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.retry(id, user.userId);
  }
}
