import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import type { OfferCtaType, OfferType } from "@prisma/client";
import { OfferVariantDto } from "./offer-variant.dto";

const OFFER_TYPES: OfferType[] = ["ONE_TIME", "INSTALLMENT", "SUBSCRIPTION", "APPLICATION_BASED"];
const CTA_TYPES: OfferCtaType[] = ["BUY_NOW", "ORDER_FORM", "APPLY_NOW", "BOOK_CALL", "PAY_INSTALLMENT"];

// Single-currency platform today (see PROJECT_STATUS.md) — a plain String column on Offer (not a
// Prisma enum) so widening this list later is a code change, not a migration. Validated here at
// the DTO boundary instead.
export const ALLOWED_CURRENCIES = ["UZS"] as const;

export class CreateOfferDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  productId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "Slug faqat kichik lotin harflari, raqamlar va tire (-) dan iborat bo'lishi kerak." })
  @MaxLength(200)
  slug!: string;

  @ApiPropertyOptional({ enum: OFFER_TYPES, default: "ONE_TIME" })
  @IsOptional()
  @IsIn(OFFER_TYPES)
  offerType?: OfferType;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  headline!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  subheadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalDescription?: string;

  // Payable price — the actual amount a buyer pays. Must be > 0: this platform doesn't support
  // free offers yet (no such flow exists anywhere downstream — checkout, commission calc, or
  // payment adapters), so allowing 0 here would create a state nothing else can handle correctly.
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priceMinor!: number;

  // Original/compare-at price. Optional; when present, cross-checked against priceMinor in the
  // service (sale price cannot exceed original price) — a single-field bound like @Min() can't
  // express that cross-field rule, so it lives in OffersService.assertPricingIsConsistent().
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  compareAtPriceMinor?: number;

  @ApiPropertyOptional({ enum: ALLOWED_CURRENCIES, default: "UZS" })
  @IsOptional()
  @IsIn(ALLOWED_CURRENCIES)
  currency?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bonuses?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryInfo?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  paymentOptions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  installmentOptions?: string;

  @ApiPropertyOptional({ enum: CTA_TYPES, default: "BUY_NOW" })
  @IsOptional()
  @IsIn(CTA_TYPES)
  ctaType?: OfferCtaType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  ctaLabel?: string;

  @ApiPropertyOptional({ description: "ISO 8601" })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ description: "ISO 8601" })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isIndexable?: boolean;

  @ApiPropertyOptional({ type: [OfferVariantDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => OfferVariantDto)
  variants?: OfferVariantDto[];
}
