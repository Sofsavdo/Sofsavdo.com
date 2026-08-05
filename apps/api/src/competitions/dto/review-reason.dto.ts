import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

// Same local-copy-per-bounded-context convention as onboarding/dto/review-reason.dto.ts.
export class ReviewReasonDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  reason!: string;
}
