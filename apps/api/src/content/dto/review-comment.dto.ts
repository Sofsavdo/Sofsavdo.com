import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

// Approve's comment is optional (unlike reject/request-changes, which reuse the
// creator-applications ReviewReasonDto's mandatory `reason` — see content.service.ts).
export class ReviewCommentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
