import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AdminDashboardService } from "./admin-dashboard.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";

@ApiTags("admin/dashboard")
@ApiBearerAuth("bearer")
@Controller("admin/dashboard")
export class AdminDashboardController {
  constructor(private dashboard: AdminDashboardService) {}

  @RequirePermissions("analytics.read")
  @Get()
  get() {
    return this.dashboard.getSummary();
  }
}
