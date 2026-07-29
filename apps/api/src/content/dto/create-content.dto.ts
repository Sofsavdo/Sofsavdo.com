import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsObject, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

// Shared by "create draft" (POST .../contents) and "edit" (PATCH /creator/contents/:id) — same
// fields are editable in both DRAFT and CHANGES_REQUESTED states (see EDIT_FROM in content.service.ts).
export class CreateContentDto {
  @ApiPropertyOptional({ description: "Post caption text." })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  caption?: string;

  // Phase P — the live URL of the creator's actual social-media post. Optional here (a draft can
  // be saved before the post exists) but required by ContentService.assertSubmittable before a
  // submit/resubmit is accepted — see DECISIONS.md ADR-033.
  @ApiPropertyOptional({ description: "Live URL of the creator's published social-media post." })
  @IsOptional()
  @IsUrl({}, { message: "postUrl to'g'ri havola (URL) bo'lishi kerak." })
  @MaxLength(2000)
  postUrl?: string;

  @ApiPropertyOptional({ description: "Creator-facing private notes, never shown publicly." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];

  @ApiPropertyOptional({ description: "Free-form structured extras (platform-specific fields)." })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
