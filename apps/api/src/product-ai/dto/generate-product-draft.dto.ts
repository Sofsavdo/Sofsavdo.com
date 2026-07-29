import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

// At least one of imageUrls/shortDescription must be given — enforced in ProductAiService rather
// than here, since class-validator's cross-field rules are awkward for a plain either-or check.
// An empty request would ask Claude to invent a product from nothing, exactly the
// fabricated-content risk this engine's review-before-save requirement (DECISIONS.md ADR-028)
// exists to guard against, not enable.
export class GenerateProductDraftDto {
  @ApiPropertyOptional({ type: [String], description: "Already-hosted image URLs (see ProductAiDraftInput's own comment)." })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  imageUrls?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  productName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  shortDescription?: string;
}
