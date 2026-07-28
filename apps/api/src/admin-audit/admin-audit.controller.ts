import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuditService } from "../common/audit/audit.service";
import { AuditQueryDto } from "./dto/audit-query.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";

// Read-only, always — no PATCH/DELETE anywhere in this controller, matching the phase's own "Read
// only. Never allow editing." requirement. `AuditService` is injectable directly (AuditModule is
// @Global()) — no new service needed, only the missing read side (see AuditService.list's comment).
@ApiTags("admin/audit-log")
@ApiBearerAuth("bearer")
@Controller("admin/audit-log")
export class AdminAuditController {
  constructor(private audit: AuditService) {}

  @RequirePermissions("audit.read")
  @Get()
  list(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }

  @RequirePermissions("audit.read")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.audit.findOneOrThrow(id);
  }
}
