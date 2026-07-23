import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";
import type { OrderStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/pagination/pagination.dto";

const STATUSES: OrderStatus[] = ["CREATED", "PAYMENT_PENDING", "PAID", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "CANCELLED", "REFUNDED"];

export class OrderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: OrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  creatorId?: string;

  @ApiPropertyOptional({ description: "ISO 8601 — createdAt >= this" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: "ISO 8601 — createdAt <= this" })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  // Matches customer fullName/phone, offer name, or Order.publicToken.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
