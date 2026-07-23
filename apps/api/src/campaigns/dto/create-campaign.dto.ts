import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
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
} from "class-validator";
import type { CommissionType, DiscountType, SocialPlatform } from "@prisma/client";

const COMMISSION_TYPES: CommissionType[] = ["PERCENTAGE", "FIXED_AMOUNT"];
const DISCOUNT_TYPES: DiscountType[] = ["PERCENTAGE", "FIXED_AMOUNT"];
const PLATFORMS: SocialPlatform[] = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "TELEGRAM"];

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  offerId!: string;

  // Creator-facing title — rendered directly in the creator catalog (see DECISIONS.md ADR-011);
  // there is deliberately no separate "internal name" field reused for this.
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ description: "Admin-only reference name, distinct from the creator-facing `name`." })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  internalName?: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "Slug faqat kichik lotin harflari, raqamlar va tire (-) dan iborat bo'lishi kerak." })
  @MaxLength(200)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: "Admin-only notes, distinct from the creator-facing `description`." })
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  category!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  ctaLabel!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  goal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetAudience?: string;

  @ApiPropertyOptional({ enum: PLATFORMS, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(PLATFORMS, { each: true })
  platforms?: SocialPlatform[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contentFormats?: string[];

  // "Dos" — also the free-form home for required hashtags/mentions/links (see schema.prisma
  // comment); no rigid dedicated columns for those, per DECISIONS.md ADR-011.
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredElements?: string[];

  @ApiPropertyOptional({ type: [String], description: "Don'ts" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  forbiddenElements?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  referenceContent?: string[];

  @ApiPropertyOptional({ description: "Simple heuristic against a creator's highest SocialAccount.followerCount." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minFollowers?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxFollowers?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  requiredContentCount?: number;

  @ApiPropertyOptional({ description: "ISO 8601" })
  @IsOptional()
  @IsDateString()
  contentDeadline?: string;

  @ApiPropertyOptional({ description: "ISO 8601" })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: "ISO 8601" })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: "ISO 8601" })
  @IsOptional()
  @IsDateString()
  applicationStartDate?: string;

  @ApiPropertyOptional({ description: "ISO 8601" })
  @IsOptional()
  @IsDateString()
  applicationDeadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  creatorLimit?: number;

  // The "application mode" the spec asked for — auto-join (false) vs. requires-approval (true).
  // Reused directly rather than adding a redundant enum; see DECISIONS.md ADR-011.
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  // Exactly one of commissionRateBps/commissionAmountMinor may be set, matching commissionType —
  // enforced in CampaignsService.assertCommissionIsValid() and by the
  // Campaign_commission_mode_check DB constraint. See DECISIONS.md ADR-013.
  @ApiProperty({ enum: COMMISSION_TYPES })
  @IsIn(COMMISSION_TYPES)
  commissionType!: CommissionType;

  @ApiPropertyOptional({ description: "Required and >0 when commissionType=PERCENTAGE. Basis points (10000 = 100%)." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  commissionRateBps?: number;

  @ApiPropertyOptional({ description: "Required and >0 when commissionType=FIXED_AMOUNT. Minor currency units." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  commissionAmountMinor?: number;

  @ApiPropertyOptional({ default: "UZS" })
  @IsOptional()
  @IsString()
  commissionCurrency?: string;

  @ApiPropertyOptional({ enum: DISCOUNT_TYPES })
  @IsOptional()
  @IsIn(DISCOUNT_TYPES)
  customerDiscountType?: DiscountType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  customerDiscountValue?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  barterEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  freeProduct?: string;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  attributionWindowDays?: number;
}
