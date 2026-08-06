import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import type { ProductStatus, ProductType } from "@prisma/client";

const PRODUCT_TYPES: ProductType[] = ["PHYSICAL_PRODUCT", "DIGITAL_PRODUCT", "COURSE", "SERVICE", "CONSULTATION"];
const PRODUCT_STATUSES: ProductStatus[] = ["DRAFT", "ACTIVE", "ARCHIVED"];
const COMMISSION_TYPES = ["PERCENTAGE", "FIXED_AMOUNT"] as const;
const FEATURED_BADGES = ["PREMIUM", "VIP"] as const;

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  // Lowercase-kebab, matching every other slugged model in this schema (Offer.slug, Campaign.slug)
  // — enforced here rather than left to the database's @unique alone, so a bad slug fails with a
  // clear VALIDATION_ERROR instead of an opaque constraint violation.
  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "Slug faqat kichik lotin harflari, raqamlar va tire (-) dan iborat bo'lishi kerak." })
  @MaxLength(200)
  slug!: string;

  @ApiProperty({ enum: PRODUCT_TYPES })
  @IsIn(PRODUCT_TYPES)
  type!: ProductType;

  // A short teaser shown in card previews (product picker, catalog grid) — kept genuinely short by
  // convention, not because 1000 chars is some hard ceiling. Full storytelling belongs in
  // `description` below, which the buyer-facing offer page's Hero actually renders.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  videos?: string[];

  // Deliberately unconstrained in shape — Prisma's Json? column accepts any valid JSON value, and
  // the real gap this fixes: an earlier `@IsObject()` here rejected `[]`, which is exactly what
  // the frontend's ProductForm sends by default (its `attributes` type is an array of
  // {key,value} pairs, not a plain object — confirmed live: this broke every product creation
  // from the real admin UI with "attributes must be an object" until this was removed).
  @ApiPropertyOptional()
  @IsOptional()
  attributes?: unknown;

  // Minor units directly (1 so'm = 100), matching Prisma's Int column — the so'm<->minor
  // conversion is a frontend-form concern (see ProductForm.tsx), not a backend contract concern.
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  costPriceMinor?: number;

  @ApiPropertyOptional({ default: "UZS" })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  creatorProfileId?: string;

  // Defaults to DRAFT (see ProductsService.create) when omitted — the one-screen admin launch
  // flow (QuickProductLaunchForm) passes ACTIVE explicitly, matching that it also activates the
  // Offer/Campaign it creates alongside the Product in the same submit.
  @ApiPropertyOptional({ enum: PRODUCT_STATUSES })
  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: ProductStatus;

  // What a Flow-based order (orders.service.ts's resolveAttribution FLOW branch) actually prices
  // a Commission from — independent of the legacy Campaign/CommissionRule path, which keeps
  // reading its own commission fields off Campaign for backward compatibility with links already
  // shared under it.
  @ApiPropertyOptional({ enum: COMMISSION_TYPES })
  @IsOptional()
  @IsIn(COMMISSION_TYPES)
  commissionType?: "PERCENTAGE" | "FIXED_AMOUNT";

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  commissionRateBps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  commissionAmountMinor?: number;

  // Marketing label only — see Product.featuredBadge's schema comment. Pin state itself moves via
  // the dedicated /pin and /unpin action endpoints, not this generic DTO (same convention as
  // status only moving through publish/complete/archive elsewhere in this codebase).
  @ApiPropertyOptional({ enum: FEATURED_BADGES, description: "PREMIUM yoki VIP belgisi (ixtiyoriy)." })
  @IsOptional()
  @IsIn(FEATURED_BADGES)
  featuredBadge?: "PREMIUM" | "VIP" | null;

  // When set, this product is never sold through Sofsavdo's own checkout — a Flow click redirects
  // straight here instead (see ReferralController.handleReferral). Used for partner-platform
  // products like Fidem, where the actual purchase happens on their own Telegram Mini App.
  @ApiPropertyOptional({ description: "Sherik platforma (masalan, Fidem) manzili — bo'lsa, Flow havolasi to'g'ridan-to'g'ri shu yerga yo'naltiradi." })
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  externalRedirectUrl?: string | null;

  @ApiPropertyOptional({ description: "Creator-picker'da ko'rsatiladigan daromad taxmini, masalan \"17 500 – 29 900 so'm\" (ixtiyoriy)." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  estimatedEarningLabel?: string | null;
}
