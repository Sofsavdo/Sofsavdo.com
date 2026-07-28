import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

// Deliberately no `key` field — a role's key is permanent once created (see CreateRoleDto), so
// renaming it is not a supported operation at all, for any role (not just the 3 seeded ones).
export class UpdateRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
