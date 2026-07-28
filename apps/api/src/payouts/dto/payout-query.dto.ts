import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";
import type { PayoutStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/pagination/pagination.dto";

const STATUSES: PayoutStatus[] = ["REQUESTED", "APPROVED", "PROCESSING", "PAID", "REJECTED", "CANCELLED", "FAILED"];

export class PayoutQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: PayoutStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  creatorId?: string;

  @ApiPropertyOptional({ description: "ISO 8601 — requestedAt >= this" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: "ISO 8601 — requestedAt <= this" })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
