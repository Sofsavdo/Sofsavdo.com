import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import type { CreatorApplicationStatus, UserStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/pagination/pagination.dto";

const ONBOARDING_STATUSES: CreatorApplicationStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED", "REJECTED"];
const ACCOUNT_STATUSES: UserStatus[] = ["ACTIVE", "SUSPENDED", "BLOCKED"];

export class CreatorQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ONBOARDING_STATUSES })
  @IsOptional()
  @IsIn(ONBOARDING_STATUSES)
  onboardingStatus?: CreatorApplicationStatus;

  @ApiPropertyOptional({ enum: ACCOUNT_STATUSES })
  @IsOptional()
  @IsIn(ACCOUNT_STATUSES)
  accountStatus?: UserStatus;

  // Matches displayName, email, or city.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
