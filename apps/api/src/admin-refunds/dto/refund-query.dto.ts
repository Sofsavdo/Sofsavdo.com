import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import type { RefundStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/pagination/pagination.dto";

const STATUSES: RefundStatus[] = ["REQUESTED", "APPROVED", "PROCESSED", "REJECTED"];

export class RefundQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: RefundStatus;

  // Matches the order's publicToken or the customer's full name.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
