import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsPositive, IsString } from "class-validator";

export class RequestPayoutDto {
  @ApiProperty()
  @IsInt()
  @IsPositive()
  amountMinor!: number;

  @ApiProperty()
  @IsString()
  payoutMethodId!: string;
}
