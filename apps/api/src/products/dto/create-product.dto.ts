import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import type { ProductType } from "@prisma/client";

const PRODUCT_TYPES: ProductType[] = ["PHYSICAL_PRODUCT", "DIGITAL_PRODUCT", "COURSE", "SERVICE", "CONSULTATION"];

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
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
}
