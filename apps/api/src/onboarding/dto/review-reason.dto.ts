import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

// Shared shape for reject/request-changes — both require a meaningful reason, same convention as
// creator-applications/dto/review-reason.dto.ts (kept as a separate local copy rather than a
// cross-module import — these are stateless DTOs, one per bounded context, matching how every
// other domain in this codebase defines its own).
export class ReviewReasonDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  reason!: string;
}
