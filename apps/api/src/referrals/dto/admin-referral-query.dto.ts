import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination/pagination.dto";
import { ACTIVITY_CLASSES, type ActivityClass } from "../activity-classification";

export class AdminReferralQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referrerCreatorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referredCreatorId?: string;

  @ApiPropertyOptional({ enum: ACTIVITY_CLASSES })
  @IsOptional()
  @IsIn(ACTIVITY_CLASSES)
  activity?: ActivityClass;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
