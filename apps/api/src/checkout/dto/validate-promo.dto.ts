import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsPositive, IsString } from "class-validator";

export class ValidatePromoDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty({ description: "Subtotal (unit price × quantity) the discount is computed against, in minor units." })
  @IsInt()
  @IsPositive()
  baseAmountMinor!: number;
}
