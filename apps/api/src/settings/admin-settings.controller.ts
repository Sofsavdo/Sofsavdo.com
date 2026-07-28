import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SettingsService } from "./settings.service";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@ApiTags("admin/settings")
@ApiBearerAuth("bearer")
@Controller("admin/settings")
export class AdminSettingsController {
  constructor(private settings: SettingsService) {}

  @RequirePermissions("settings.read")
  @Get()
  getAll() {
    return this.settings.getAll();
  }

  @RequirePermissions("settings.write")
  @Patch()
  update(@Body() dto: UpdateSettingsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.settings.update(dto.values, user.userId);
  }
}
