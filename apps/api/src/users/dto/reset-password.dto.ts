import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

// Admin-set password, not a self-service reset flow — this platform has no email-verification/
// reset-token infrastructure for staff (see PROJECT_STATUS.md's pre-Phase-11 audit); an internal
// ops panel setting a new password directly (same DEV_PASSWORD-style convention as prisma/seed.ts)
// is the correct scope for "reset password" here, not a new token-based flow.
export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
