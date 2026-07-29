import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AdminVisitorsService } from "./admin-visitors.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";

@ApiTags("admin/visitors")
@ApiBearerAuth("bearer")
@Controller("admin/visitors")
export class AdminVisitorsController {
  constructor(private visitors: AdminVisitorsService) {}

  @RequirePermissions("referral.read")
  @Get()
  list() {
    return this.visitors.list();
  }
}
