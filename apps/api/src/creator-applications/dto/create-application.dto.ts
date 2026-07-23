import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import type { SocialPlatform } from "@prisma/client";

const PLATFORMS: SocialPlatform[] = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "TELEGRAM"];

// Shared by "create" (POST .../applications, starts as DRAFT) and "update draft"
// (PATCH /creator/applications/:id) — same fields are editable in both states.
export class CreateApplicationDto {
  @ApiPropertyOptional({ description: "Creator's pitch/message" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @ApiPropertyOptional({ enum: PLATFORMS })
  @IsOptional()
  @IsIn(PLATFORMS)
  platform?: SocialPlatform;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contentFormat?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  portfolioLinks?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sampleContentLinks?: string[];

  @ApiPropertyOptional({ description: "Free-form answers to campaign-specific questions." })
  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;
}
