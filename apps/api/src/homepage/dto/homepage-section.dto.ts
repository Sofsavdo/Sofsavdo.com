import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsObject, IsOptional, IsString, ValidateIf } from "class-validator";
import type { HomepageSectionType } from "@prisma/client";

// Kept in sync with prisma/schema.prisma's HomepageSectionType enum by hand — same three-copies-
// with-no-shared-import constraint documented in landings/dto/landing-section.dto.ts.
const HOMEPAGE_SECTION_TYPES: HomepageSectionType[] = [
  "HERO",
  "WHY_SOFSAVDO",
  "FEATURED_PRODUCTS",
  "BANNER",
  "CREATOR_PROGRAM_BLURB",
  "BENEFITS",
  "FAQ",
  "SUPPORT",
  "CUSTOM_RICH_TEXT",
  "CATEGORY_GRID",
];

export class CreateHomepageSectionDto {
  @ApiProperty({ enum: HOMEPAGE_SECTION_TYPES })
  @IsIn(HOMEPAGE_SECTION_TYPES)
  type!: HomepageSectionType;

  @ApiPropertyOptional({ description: "Structured block content — shape depends on `type` (see homepageSectionTypeConfig.ts on the frontend). Ignored for FEATURED_PRODUCTS, which always delegates to OffersService.listFeaturedPublic()." })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: "ISO 8601 — section is SCHEDULED (not yet public) before this instant." })
  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @ApiPropertyOptional({ description: "ISO 8601 — section is EXPIRED (no longer public) after this instant." })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class UpdateHomepageSectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Nullable so a scheduled banner's window can be cleared, not just set — @ValidateIf skips the
  // ISO8601 check specifically for an explicit `null` (clear), while `undefined` (omitted field)
  // leaves the stored value untouched, same three-state convention as BuyerAddress's optional PATCH fields.
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsISO8601()
  startsAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsISO8601()
  expiresAt?: string | null;
}

export class ReorderHomepageSectionsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderedIds!: string[];
}
