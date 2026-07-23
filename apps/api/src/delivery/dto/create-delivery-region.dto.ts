import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";
import type { DeliveryAvailability, DeliveryFeeType } from "@prisma/client";

const FEE_TYPES: DeliveryFeeType[] = ["FREE", "FIXED"];
const AVAILABILITY: DeliveryAvailability[] = ["AVAILABLE", "UNAVAILABLE"];

export class CreateDeliveryRegionDto {
  @ApiPropertyOptional({ default: "UZ" })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  regionCode!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  regionName!: string;

  @ApiPropertyOptional({ enum: AVAILABILITY, default: "AVAILABLE" })
  @IsOptional()
  @IsIn(AVAILABILITY)
  availability?: DeliveryAvailability;

  @ApiProperty({ enum: FEE_TYPES })
  @IsIn(FEE_TYPES)
  feeType!: DeliveryFeeType;

  // Required (>0) when feeType=FIXED, must be omitted/0 when feeType=FREE — enforced in
  // DeliveryService and by the OfferDeliveryRegion_fee_check DB constraint.
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  deliveryFeeMinor?: number;

  @ApiPropertyOptional({ default: "UZS" })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedMinDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedMaxDays?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
