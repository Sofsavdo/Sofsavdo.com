import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { PERMISSIONS, type PermissionKey } from "../permissions.constants";

export class AssignPermissionDto {
  @ApiProperty({ enum: PERMISSIONS })
  @IsIn(PERMISSIONS)
  permissionKey!: PermissionKey;
}
