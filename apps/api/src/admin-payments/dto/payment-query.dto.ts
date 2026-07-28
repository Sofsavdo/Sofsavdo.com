import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import type { PaymentProviderType, PaymentStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/pagination/pagination.dto";

const STATUSES: PaymentStatus[] = ["PENDING", "PROCESSING", "PAID", "FAILED", "CANCELLED", "REFUNDED"];
const PROVIDERS: PaymentProviderType[] = ["CLICK", "PAYME", "UZUM_NASIYA", "CARD", "CASH_ON_DELIVERY", "MANUAL"];

export class PaymentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: PaymentStatus;

  @ApiPropertyOptional({ enum: PROVIDERS })
  @IsOptional()
  @IsIn(PROVIDERS)
  provider?: PaymentProviderType;

  // Matches the order's publicToken or the customer's full name.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
