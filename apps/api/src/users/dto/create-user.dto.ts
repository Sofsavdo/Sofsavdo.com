import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

// Staff creation — mirrors RegisterDto's email/phone shape (auth/dto/register.dto.ts) but adds
// displayName (staff accounts need a real name, unlike the pre-Phase-12 email-local-part shim —
// see schema.prisma's User.displayName comment) and roleIds (a staff account with zero roles is
// technically valid but useless, so at least one is required at creation time).
export class CreateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  displayName!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roleIds!: string[];
}
