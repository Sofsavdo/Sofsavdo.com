import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";
import type { CommissionStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/pagination/pagination.dto";

const STATUSES: CommissionStatus[] = ["PENDING", "APPROVED", "REJECTED", "REFUNDED", "PAYABLE", "PAID"];

export class CommissionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: CommissionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  creatorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiPropertyOptional({ description: "ISO 8601 — createdAt >= this" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: "ISO 8601 — createdAt <= this" })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  // Matches creator displayName, campaign name, or Order.publicToken.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
