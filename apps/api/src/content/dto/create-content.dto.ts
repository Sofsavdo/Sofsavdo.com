import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

// Shared by "create draft" (POST .../contents) and "edit" (PATCH /creator/contents/:id) — same
// fields are editable in both DRAFT and CHANGES_REQUESTED states (see EDIT_FROM in content.service.ts).
export class CreateContentDto {
  @ApiPropertyOptional({ description: "Post caption text." })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  caption?: string;

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
