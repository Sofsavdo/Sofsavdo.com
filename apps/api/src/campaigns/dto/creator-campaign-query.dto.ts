import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import type { CommissionType, SocialPlatform } from "@prisma/client";

const PLATFORMS: SocialPlatform[] = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "TELEGRAM"];
const COMMISSION_TYPES: CommissionType[] = ["PERCENTAGE", "FIXED_AMOUNT"];

// No pagination — the creator catalog is small and filtered entirely server-side (eligibility +
// visibility are never left to the frontend), matching the existing mock catalog's shape.
export class CreatorCampaignQueryDto {
  @ApiPropertyOptional({ enum: PLATFORMS })
  @IsOptional()
  @IsIn(PLATFORMS)
  platform?: SocialPlatform;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contentFormat?: string;

  @ApiPropertyOptional({ enum: COMMISSION_TYPES })
  @IsOptional()
  @IsIn(COMMISSION_TYPES)
  commissionType?: CommissionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
