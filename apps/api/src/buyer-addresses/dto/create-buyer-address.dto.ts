import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateBuyerAddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  region!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  city!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  line1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}
