import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import type { OfferStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/pagination/pagination.dto";
import { ALLOWED_CURRENCIES } from "./create-offer.dto";

const OFFER_STATUSES: OfferStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"];

export class OfferQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ enum: OFFER_STATUSES })
  @IsOptional()
  @IsIn(OFFER_STATUSES)
  status?: OfferStatus;

  @ApiPropertyOptional({ enum: ALLOWED_CURRENCIES })
  @IsOptional()
  @IsIn(ALLOWED_CURRENCIES)
  currency?: string;

  // Tri-state, not boolean-with-default: omitted = don't filter on archive state at all (the
  // admin list's default view still shows archived offers, same as Products), true = only
  // archived, false = only non-archived.
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  archived?: boolean;

  // Matches offer name, offer slug, product name, or product SKU — case-insensitive. Requires a
  // join to Product, handled in OffersService.list() via a single query (no N+1).
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
