import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination/pagination.dto";

export class AuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "e.g. 'User', 'Refund', 'Role', 'Setting', 'CreatorApplication'" })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({ description: "e.g. 'STAFF_CREATED', 'REFUND_APPROVED', 'SETTINGS_UPDATED'" })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: "ISO 8601 — createdAt >= this" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: "ISO 8601 — createdAt <= this" })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  // Matches entityId or the actor's email.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
