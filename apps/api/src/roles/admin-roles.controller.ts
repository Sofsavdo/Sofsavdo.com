import { Body, Controller, Get, Param, Patch, Post, Delete } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RolesService } from "./roles.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { AssignPermissionDto } from "./dto/assign-permission.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@ApiTags("admin/roles")
@ApiBearerAuth("bearer")
@Controller("admin/roles")
export class AdminRolesController {
  constructor(private roles: RolesService) {}

  @RequirePermissions("role.read")
  @Get()
  list() {
    return this.roles.listRoles();
  }

  @RequirePermissions("role.read")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.roles.findRoleOrThrow(id);
  }

  @RequirePermissions("role.manage")
  @Post()
  create(@Body() dto: CreateRoleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.roles.createRole(dto, user.userId);
  }

  @RequirePermissions("role.manage")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateRoleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.roles.updateRole(id, dto, user.userId);
  }

  @RequirePermissions("role.manage")
  @Post(":id/permissions")
  assignPermission(@Param("id") id: string, @Body() dto: AssignPermissionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.roles.assignPermission(id, dto.permissionKey, user.userId);
  }

  @RequirePermissions("role.manage")
  @Delete(":id/permissions/:permissionKey")
  removePermission(@Param("id") id: string, @Param("permissionKey") permissionKey: string, @CurrentUser() user: AuthenticatedUser) {
    return this.roles.removePermission(id, permissionKey, user.userId);
  }
}

// Separate controller (distinct route prefix, no :id path param) — the permission-matrix source
// for the admin UI, not scoped to any one role.
@ApiTags("admin/permissions")
@ApiBearerAuth("bearer")
@Controller("admin/permissions")
export class AdminPermissionsController {
  constructor(private roles: RolesService) {}

  @RequirePermissions("role.read")
  @Get()
  list() {
    return this.roles.listAllPermissionKeys();
  }
}
