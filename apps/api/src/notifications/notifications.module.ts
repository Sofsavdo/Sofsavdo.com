import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationEventsListener } from "./notification-events.listener";
import { NotificationSweepService } from "./notification-sweep.service";
import { CreatorNotificationsController } from "./creator-notifications.controller";
import { AdminNotificationsController } from "./admin-notifications.controller";
import { TELEGRAM_PORT } from "./telegram.port";
import { TelegramBotAdapter } from "./telegram-bot.adapter";
import { EMAIL_PORT } from "./email.port";
import { SmtpEmailAdapter } from "./smtp.adapter";

// NotificationEventsListener/NotificationSweepService are the only two places any other domain's
// business event becomes a Notification — see DECISIONS.md ADR-017. Neither OrdersModule,
// PaymentsModule, CommissionsModule, nor PayoutsModule import this module or vice versa: the
// sweep reads their tables directly via PrismaService (read-only) exactly like
// CommissionsService.reconcileRefundedOrders reads Order without importing OrdersModule.
@Module({
  controllers: [CreatorNotificationsController, AdminNotificationsController],
  providers: [
    NotificationsService,
    NotificationEventsListener,
    NotificationSweepService,
    { provide: TELEGRAM_PORT, useClass: TelegramBotAdapter },
    { provide: EMAIL_PORT, useClass: SmtpEmailAdapter },
  ],
  // NotificationSweepService is exported solely so HealthModule can read its run heartbeat
  // (last successful sweep time / last error) for the /health/status diagnostic endpoint —
  // it does not become a general-purpose cross-module dependency.
  exports: [NotificationsService, NotificationSweepService],
})
export class NotificationsModule {}
