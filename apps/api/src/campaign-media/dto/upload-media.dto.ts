import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Min, MaxLength } from "class-validator";
import type { CampaignMediaRole } from "@prisma/client";

const MEDIA_ROLES: CampaignMediaRole[] = ["COVER", "GALLERY", "PROMOTIONAL"];

// multipart/form-data fields alongside the uploaded file. Width/height/durationSeconds are only
// meaningful (and only trusted) for VIDEO uploads — see media-validation.ts's honesty note on why
// video frame metadata is client-reported rather than server-decoded.
export class UploadMediaDto {
  @ApiProperty({ enum: MEDIA_ROLES })
  @IsIn(MEDIA_ROLES)
  mediaRole!: CampaignMediaRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  altText?: string;

  @ApiPropertyOptional({ description: "VIDEO only — client-reported frame width." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  width?: number;

  @ApiPropertyOptional({ description: "VIDEO only — client-reported frame height." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  height?: number;

  @ApiPropertyOptional({ description: "VIDEO only — client-reported duration." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationSeconds?: number;
}
