import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import type { CampaignStatus, SocialPlatform } from "@prisma/client";
import { PaginationQueryDto } from "../../common/pagination/pagination.dto";

const CAMPAIGN_STATUSES: CampaignStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];
const PLATFORMS: SocialPlatform[] = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "TELEGRAM"];

export class CampaignQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  offerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ enum: CAMPAIGN_STATUSES })
  @IsOptional()
  @IsIn(CAMPAIGN_STATUSES)
  status?: CampaignStatus;

  @ApiPropertyOptional({ enum: PLATFORMS })
  @IsOptional()
  @IsIn(PLATFORMS)
  platform?: SocialPlatform;

  // Tri-state, not boolean-with-default — omitted means "don't filter on archive state" (matches
  // Offer/Landing's convention).
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  archived?: boolean;

  @ApiPropertyOptional({ description: "true = requires approval, false = auto-join" })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresApproval?: boolean;

  // Matches Campaign name/internalName/slug, or the linked Offer's name/slug, or the linked
  // Product's name/SKU — same multi-field search convention as Offer's list endpoint.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
