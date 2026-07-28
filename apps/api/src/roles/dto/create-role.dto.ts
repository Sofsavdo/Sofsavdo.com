import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MinLength } from "class-validator";

export class CreateRoleDto {
  // Same lowercase-snake convention as the 3 seeded keys (manager/admin/super_admin) — immutable
  // once created (no rename endpoint), matching how prisma/seed.ts's upsert keys off this field.
  @ApiProperty({ description: "Lowercase, unique, permanent identifier (e.g. 'support_staff')." })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/, { message: "key faqat kichik lotin harflari, raqamlar va pastki chiziqdan iborat bo'lishi kerak." })
  key!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
