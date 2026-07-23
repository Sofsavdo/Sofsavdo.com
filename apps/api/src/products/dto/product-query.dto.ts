import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import type { ProductStatus, ProductType } from "@prisma/client";
import { PaginationQueryDto } from "../../common/pagination/pagination.dto";

const PRODUCT_STATUSES: ProductStatus[] = ["DRAFT", "ACTIVE", "ARCHIVED"];
const PRODUCT_TYPES: ProductType[] = ["PHYSICAL_PRODUCT", "DIGITAL_PRODUCT", "COURSE", "SERVICE", "CONSULTATION"];

export class ProductQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PRODUCT_STATUSES })
  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: ProductStatus;

  @ApiPropertyOptional({ enum: PRODUCT_TYPES })
  @IsOptional()
  @IsIn(PRODUCT_TYPES)
  type?: ProductType;

  // Matches name or SKU, case-insensitive — mirrors the search box every admin list page in the
  // Phase 5 frontend already has (client-side, over the mock's full in-memory array); this is the
  // server-side equivalent for when that page switches to the real API in 6E.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
