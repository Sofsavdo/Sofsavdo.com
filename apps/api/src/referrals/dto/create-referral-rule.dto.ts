import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";
import type { ReferralMilestoneType, ReferralRewardType } from "@prisma/client";

const REWARD_TYPES: ReferralRewardType[] = ["MILESTONE_FIXED", "EARNINGS_PERCENTAGE"];
const MILESTONE_TYPES: ReferralMilestoneType[] = [
  "FIRST_APPROVED_CAMPAIGN_APPLICATION",
  "FIRST_APPROVED_CONTENT",
  "FIRST_QUALIFIED_SALE",
  "FIRST_APPROVED_COMMISSION",
  "MIN_CUMULATIVE_EARNINGS",
];

export class CreateReferralRuleDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ enum: REWARD_TYPES })
  @IsIn(REWARD_TYPES)
  rewardType!: ReferralRewardType;

  // Required (and only meaningful) when rewardType=MILESTONE_FIXED.
  @ApiPropertyOptional({ enum: MILESTONE_TYPES })
  @IsOptional()
  @IsIn(MILESTONE_TYPES)
  milestoneType?: ReferralMilestoneType;

  @ApiPropertyOptional({ description: "Required when rewardType=MILESTONE_FIXED. Minor currency units." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  fixedRewardMinor?: number;

  @ApiPropertyOptional({ description: "Required when rewardType=EARNINGS_PERCENTAGE. Basis points." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rewardRateBps?: number;

  @ApiPropertyOptional({ default: "UZS" })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  qualifyingEarningsThresholdMinor?: number;

  @ApiPropertyOptional({ description: "EARNINGS_PERCENTAGE only — how many days of earnings after attribution count." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  earningWindowDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maximumRewardPerReferralMinor?: number;

  @ApiPropertyOptional({ description: "ISO 8601" })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ description: "ISO 8601" })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
