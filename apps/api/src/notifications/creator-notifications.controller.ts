import { Body, Controller, Get, Param, ParseEnumPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { NotificationQueryDto } from "./dto/notification-query.dto";
import { UpdateNotificationPreferenceDto } from "./dto/update-preference.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";
import { NotificationCategory } from "@prisma/client";

// Ownership-scoped by userId from the JWT (not creatorId, not RBAC-gated — admins have
// notifications too, and a not-yet-approved creator still needs to see their own
// "application submitted" notification, so this deliberately does NOT sit behind
// RequireCreatorGuard). Any authenticated user only ever sees their own rows.
@ApiTags("creator/notifications")
@ApiBearerAuth("bearer")
@Controller()
export class CreatorNotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get("creator/notifications")
  list(@Query() query: NotificationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.list(user.userId, query);
  }

  @Get("creator/notifications/:id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.findOneOrThrow(id, user.userId);
  }

  @Patch("creator/notifications/:id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markRead(id, user.userId);
  }

  @Post("creator/notifications/mark-all-read")
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.userId);
  }

  @Get("creator/notification-preferences")
  getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.getPreferences(user.userId);
  }

  @Patch("creator/notification-preferences/:category")
  updatePreference(
    @Param("category", new ParseEnumPipe(NotificationCategory)) category: NotificationCategory,
    @Body() dto: UpdateNotificationPreferenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notifications.updatePreference(user.userId, category, dto);
  }
}
