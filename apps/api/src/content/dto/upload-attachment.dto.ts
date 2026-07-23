import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Min } from "class-validator";
import type { ContentAttachmentRole } from "@prisma/client";

const ATTACHMENT_ROLES: ContentAttachmentRole[] = ["ATTACHMENT", "THUMBNAIL"];

// multipart/form-data fields alongside the uploaded file — same shape/honesty convention as
// Campaign Media's UploadMediaDto (video width/height/durationSeconds are client-reported, never
// server-decoded; see content-validation.ts).
export class UploadAttachmentDto {
  @ApiProperty({ enum: ATTACHMENT_ROLES })
  @IsIn(ATTACHMENT_ROLES)
  role!: ContentAttachmentRole;

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
