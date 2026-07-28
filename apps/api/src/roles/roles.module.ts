import { Module } from "@nestjs/common";
import { RolesService } from "./roles.service";
import { AdminRolesController, AdminPermissionsController } from "./admin-roles.controller";

@Module({
  controllers: [AdminRolesController, AdminPermissionsController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
