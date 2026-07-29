import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength, ValidateIf } from "class-validator";

// Buyer self-registration — deliberately a separate DTO/endpoint from RegisterDto, not a shared
// "role" field on one endpoint: RegisterDto's register() unconditionally creates a CreatorProfile
// + DRAFT CreatorApplication (see AuthService.register()), which a buyer must never get. A plain
// User row with no CreatorProfile is exactly what a buyer needs — see AuthService.registerBuyer().
export class RegisterBuyerDto {
  @ApiPropertyOptional()
  @ValidateIf((o: RegisterBuyerDto) => !o.phone)
  @IsEmail({}, { message: "Email formati noto'g'ri." })
  email?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: RegisterBuyerDto) => !o.email)
  @IsString()
  phone?: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: "Parol kamida 8 belgidan iborat bo'lishi kerak." })
  password!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  fullName!: string;
}
