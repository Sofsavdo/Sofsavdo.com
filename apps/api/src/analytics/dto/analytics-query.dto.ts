import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination/pagination.dto";
import type { AnalyticsCompareMode, AnalyticsRangePreset } from "../lib/time-range.resolver";

const RANGE_PRESETS: AnalyticsRangePreset[] = ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "quarter", "year", "custom"];
const COMPARE_MODES: AnalyticsCompareMode[] = ["none", "previous", "wow", "mom", "yoy"];

// One shared querystring contract for every analytics endpoint (§7/§14 of ANALYTICS.md) — list-
// shaped views (Creator/Campaign/Product) use the inherited page/pageSize/sortBy/sortDir
// meaningfully; single-view endpoints (Executive/Payment/Refund/Customer) simply ignore them.
// `status` is intentionally a plain string, not one fixed enum — each sub-service validates it
// against whichever enum is actually relevant to that view (OrderStatus/PaymentStatus/
// RefundStatus), per ANALYTICS.md §14.
export class AnalyticsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RANGE_PRESETS, default: "this_month" })
  @IsOptional()
  @IsIn(RANGE_PRESETS)
  range: AnalyticsRangePreset = "this_month";

  @ApiPropertyOptional({ description: "ISO 8601 — required when range=custom. Inclusive lower bound." })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: "ISO 8601 — required when range=custom. Exclusive upper bound." })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ enum: COMPARE_MODES, default: "none" })
  @IsOptional()
  @IsIn(COMPARE_MODES)
  compare: AnalyticsCompareMode = "none";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  creatorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: "PaymentProviderType value, e.g. CLICK/CASH_ON_DELIVERY" })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: "Order.address.region text match" })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ description: "View-specific status enum value — validated per view" })
  @IsOptional()
  @IsString()
  status?: string;
}
