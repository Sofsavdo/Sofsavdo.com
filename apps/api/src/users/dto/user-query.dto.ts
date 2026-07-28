import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import type { UserStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/pagination/pagination.dto";

const STATUSES: UserStatus[] = ["ACTIVE", "SUSPENDED", "BLOCKED", "DELETED"];

export class UserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: UserStatus;

  @ApiPropertyOptional({ description: "Role key, e.g. 'admin'" })
  @IsOptional()
  @IsString()
  roleKey?: string;

  // Matches displayName or email.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
