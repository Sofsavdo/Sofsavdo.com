import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CustomerInfoDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/, { message: "Telefon raqami noto'g'ri formatda." })
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: "Required for PHYSICAL_PRODUCT offers." })
  @IsOptional()
  @IsString()
  region?: string;

  // Not in the Phase 8 spec's own "Customer Information" field list (Region/District/Address/
  // Notes) — kept as an optional bridge to the existing frontend checkout form, which predates
  // this phase and already collects a separate "Shahar" (city) field alongside region ("Viloyat").
  // Address.city is a required DB column; falls back to region when omitted (see OrdersService).
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ description: "Required for PHYSICAL_PRODUCT offers." })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
