import { Controller, Delete, Get, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { TelegramLinkService } from "./telegram-link.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

// Any authenticated user (admin or creator) can link their own Telegram chat — same
// ownership-scoped-by-JWT-userId convention as CreatorNotificationsController, not RBAC-gated.
@ApiTags("notifications/telegram")
@ApiBearerAuth("bearer")
@Controller("notifications/telegram")
export class TelegramLinkController {
  constructor(private telegramLink: TelegramLinkService) {}

  @Get("link")
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.telegramLink.getStatus(user.userId);
  }

  @Post("link-token")
  createLinkToken(@CurrentUser() user: AuthenticatedUser) {
    return this.telegramLink.createLinkToken(user.userId);
  }

  @Delete("link")
  @HttpCode(200)
  unlink(@CurrentUser() user: AuthenticatedUser) {
    return this.telegramLink.unlink(user.userId);
  }
}
