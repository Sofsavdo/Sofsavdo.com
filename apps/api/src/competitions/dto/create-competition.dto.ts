import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class CreateCompetitionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "Slug faqat kichik lotin harflari, raqamlar va tire (-) dan iborat bo'lishi kerak." })
  @MaxLength(200)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: "Free text — the prize is announced/fulfilled manually by an admin, not paid out through Commission/Payout." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  prizeDescription?: string;

  @ApiProperty()
  @IsDateString()
  startAt!: string;

  @ApiProperty()
  @IsDateString()
  endAt!: string;
}
