import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";

// Only two roles are meaningful here — see DebugSeedController's own comment for why this
// endpoint exists at all and why it is intentionally narrow (not a general-purpose user-creation
// API).
export type SeedTestUserRole = "admin" | "creator";

export class SeedTestUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: ["admin", "creator"] })
  @IsIn(["admin", "creator"])
  role!: SeedTestUserRole;

  // Only meaningful for role="creator" (CreatorProfile.displayName is required, non-null).
  // Ignored for role="admin".
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  displayName?: string;
}
