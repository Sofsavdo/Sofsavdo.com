import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { CreatorTier } from "@prisma/client";

export class SetTierDto {
  @ApiProperty({ enum: CreatorTier })
  @IsEnum(CreatorTier)
  tier!: CreatorTier;
}
