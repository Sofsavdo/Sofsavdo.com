import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, IsPositive, IsString, MaxLength } from "class-validator";

export class ContributeToFundDto {
  @ApiProperty()
  @IsInt()
  @IsPositive()
  amountMinor!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}
