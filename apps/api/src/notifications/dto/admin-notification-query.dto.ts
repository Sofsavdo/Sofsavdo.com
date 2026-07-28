import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import type { NotificationChannel, NotificationDeliveryStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/pagination/pagination.dto";

const CHANNELS: NotificationChannel[] = ["IN_APP", "TELEGRAM", "EMAIL"];
const STATUSES: NotificationDeliveryStatus[] = ["PENDING", "SENT", "FAILED"];

// Admin notification queue — GET /admin/notifications[?status=FAILED]. The dedicated
// GET /admin/notifications/failed route is this same query pre-filtered to status=FAILED.
export class AdminNotificationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CHANNELS })
  @IsOptional()
  @IsIn(CHANNELS)
  channel?: NotificationChannel;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: NotificationDeliveryStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;
}
