import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsPositive, IsString, MinLength } from "class-validator";

export class CreateRefundDto {
  @ApiProperty()
  @IsInt()
  @IsPositive()
  amountMinor!: number;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason!: string;
}
