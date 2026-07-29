import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Min } from "class-validator";
import type { ProductType } from "@prisma/client";
import { PaginationQueryDto } from "../../common/pagination/pagination.dto";

const PRODUCT_TYPES: ProductType[] = ["PHYSICAL_PRODUCT", "DIGITAL_PRODUCT", "COURSE", "SERVICE", "CONSULTATION"];

// Deliberately no `search` field — docs/PROHIBITED.md still bans public search of any kind even
// after the catalog itself is allowed (see DECISIONS.md's Phase E ADR). `pageSize`'s inherited
// `@Max(100)` from PaginationQueryDto is a second, DTO-level bound; OffersService.listCatalog also
// hard-clamps to CATALOG_MAX_PAGE_SIZE regardless, the same defense-in-depth "never trust the
// client alone" pattern already used for the homepage's FEATURED_OFFERS_LIMIT.
export class CatalogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PRODUCT_TYPES })
  @IsOptional()
  @IsIn(PRODUCT_TYPES)
  type?: ProductType;

  @ApiPropertyOptional({ description: "Minor units (tiyin)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPriceMinor?: number;

  @ApiPropertyOptional({ description: "Minor units (tiyin)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPriceMinor?: number;
}
