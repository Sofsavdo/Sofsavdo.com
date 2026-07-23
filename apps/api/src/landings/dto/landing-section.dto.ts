import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString } from "class-validator";
import type { LandingSectionType } from "@prisma/client";

// Kept in sync with prisma/schema.prisma's LandingSectionType enum and packages/types'
// LandingSectionType — three copies of the same list (Prisma, this DTO, frontend) because none
// of the three can import from another across the API boundary; RBAC.md-style drift protection
// isn't practical here, so this list is small and reviewed alongside any schema enum change.
const SECTION_TYPES: LandingSectionType[] = [
  "HERO",
  "PROBLEM",
  "SOLUTION",
  "BENEFITS",
  "HOW_IT_WORKS",
  "AUDIENCE",
  "NOT_FOR",
  "CREATOR_VIDEO",
  "PRODUCT_GALLERY",
  "PRICING",
  "OFFER_VARIANTS",
  "BONUSES",
  "REVIEWS",
  "GUARANTEE",
  "TERMS",
  "DELIVERY",
  "PAYMENT",
  "FAQ",
  "FINAL_CTA",
  "CUSTOM_RICH_TEXT",
];

export class CreateLandingSectionDto {
  @ApiProperty({ enum: SECTION_TYPES })
  @IsIn(SECTION_TYPES)
  type!: LandingSectionType;

  @ApiPropertyOptional({ description: "Structured block content — shape depends on `type` (see sectionTypeConfig.ts on the frontend)." })
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
}

export class UpdateLandingSectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReorderLandingSectionsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderedIds!: string[];
}
