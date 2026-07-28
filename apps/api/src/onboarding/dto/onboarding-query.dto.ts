import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";
import type { CreatorApplicationStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/pagination/pagination.dto";

const STATUSES: CreatorApplicationStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED", "REJECTED"];

export class OnboardingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: CreatorApplicationStatus;

  @ApiPropertyOptional({ description: "ISO 8601 — createdAt >= this" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: "ISO 8601 — createdAt <= this" })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  // Matches creator displayName or email.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
