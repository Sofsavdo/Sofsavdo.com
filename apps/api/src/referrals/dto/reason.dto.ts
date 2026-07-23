import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

// Shared by disqualify / reward-reject — every admin action that ends a referral or reward's
// chances must carry a reason (spec: "Disqualification and reward rejection must require
// reasons"), same pattern as the Creator Application domain's ReviewReasonDto.
export class ReasonDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  reason!: string;
}
