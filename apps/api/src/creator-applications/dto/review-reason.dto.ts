import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

// Shared shape for reject/request-changes — both require a meaningful reason (see
// REVIEW_REASON_REQUIRED in domain-error.ts).
export class ReviewReasonDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  reason!: string;
}
