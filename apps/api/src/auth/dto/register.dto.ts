import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength, ValidateIf } from "class-validator";

// Creator self-registration only — admin/manager/super_admin accounts are provisioned by seed
// or by a super-admin via /admin/users (Phase 6D), never via this public endpoint.
export class RegisterDto {
  @ApiPropertyOptional()
  @ValidateIf((o: RegisterDto) => !o.phone)
  @IsEmail({}, { message: "Email formati noto'g'ri." })
  email?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: RegisterDto) => !o.email)
  @IsString()
  phone?: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: "Parol kamida 8 belgidan iborat bo'lishi kerak." })
  password!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  displayName!: string;

  // The referrer's CreatorProfile.referralCode, from a link like /creator/register?ref=ABC123.
  // Attribution happens once, here, at registration — see AuthService.register() and
  // DECISIONS.md ADR-013. An unknown/invalid code never blocks registration; it's silently
  // ignored (see ReferralsService.attributeAtRegistration).
  @ApiPropertyOptional()
  @ValidateIf((o: RegisterDto) => !!o.referralCode)
  @IsString()
  referralCode?: string;
}
