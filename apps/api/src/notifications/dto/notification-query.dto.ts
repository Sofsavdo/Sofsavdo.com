import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import type { NotificationChannel } from "@prisma/client";
import { PaginationQueryDto } from "../../common/pagination/pagination.dto";

const CHANNELS: NotificationChannel[] = ["IN_APP", "TELEGRAM", "EMAIL"];

// Creator/admin self-service list — GET /creator/notifications. Filters by channel and read
// state; `type` lets the UI filter to one event kind (e.g. only "payout.*").
export class NotificationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CHANNELS })
  @IsOptional()
  @IsIn(CHANNELS)
  channel?: NotificationChannel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: "true = unread only, false = read only, omit = both" })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean;
}
