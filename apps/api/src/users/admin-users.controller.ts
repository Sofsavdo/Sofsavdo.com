import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserQueryDto } from "./dto/user-query.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { AssignRoleDto } from "./dto/assign-role.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@ApiTags("admin/users")
@ApiBearerAuth("bearer")
@Controller("admin/users")
export class AdminUsersController {
  constructor(private users: UsersService) {}

  @RequirePermissions("user.read")
  @Get()
  list(@Query() query: UserQueryDto) {
    return this.users.list(query);
  }

  @RequirePermissions("user.read")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.users.findOneOrThrow(id);
  }

  @RequirePermissions("user.manage")
  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.users.create(dto, user.userId);
  }

  @RequirePermissions("user.manage")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.users.update(id, dto, user.userId);
  }

  @RequirePermissions("user.manage")
  @Post(":id/activate")
  activate(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.users.activate(id, user.userId);
  }

  @RequirePermissions("user.manage")
  @Post(":id/deactivate")
  deactivate(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.users.deactivate(id, user.userId);
  }

  @RequirePermissions("user.manage")
  @Post(":id/reset-password")
  resetPassword(@Param("id") id: string, @Body() dto: ResetPasswordDto, @CurrentUser() user: AuthenticatedUser) {
    return this.users.resetPassword(id, dto.newPassword, user.userId);
  }

  @RequirePermissions("user.manage")
  @Post(":id/roles")
  assignRole(@Param("id") id: string, @Body() dto: AssignRoleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.users.assignRole(id, dto.roleId, user.userId);
  }

  @RequirePermissions("user.manage")
  @Delete(":id/roles/:roleId")
  removeRole(@Param("id") id: string, @Param("roleId") roleId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.users.removeRole(id, roleId, user.userId);
  }
}
