import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./prisma/prisma.module";
import { CommonModule } from "./common/common.module";
import { AuditModule } from "./common/audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { RolesModule } from "./roles/roles.module";
import { HealthModule } from "./health/health.module";
import { ProductsModule } from "./products/products.module";
import { OffersModule } from "./offers/offers.module";
import { LandingsModule } from "./landings/landings.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { CreatorApplicationsModule } from "./creator-applications/creator-applications.module";
import { CreatorProfileModule } from "./creator-profile/creator-profile.module";
import { StorageModule } from "./storage/storage.module";
import { CampaignMediaModule } from "./campaign-media/campaign-media.module";
import { DeliveryModule } from "./delivery/delivery.module";
import { ReferralsModule } from "./referrals/referrals.module";
import { ContentModule } from "./content/content.module";
import { PromoCodesModule } from "./promo-codes/promo-codes.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentsModule } from "./payments/payments.module";
import { CheckoutModule } from "./checkout/checkout.module";
import { CommissionsModule } from "./commissions/commissions.module";
import { PayoutMethodsModule } from "./payout-methods/payout-methods.module";
import { PayoutsModule } from "./payouts/payouts.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OnboardingModule } from "./onboarding/onboarding.module";
import { AdminCreatorsModule } from "./admin-creators/admin-creators.module";
import { AdminPaymentsModule } from "./admin-payments/admin-payments.module";
import { AdminRefundsModule } from "./admin-refunds/admin-refunds.module";
import { SettingsModule } from "./settings/settings.module";
import { AdminAuditModule } from "./admin-audit/admin-audit.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { RequestLoggingInterceptor } from "./common/interceptors/request-logging.interceptor";
import configuration from "./config/configuration";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    // Phase 10's event bus — business services emit named events (real direct .emit() calls from
    // domains this phase is free to edit; a scheduled sweep synthesizes the same events for the
    // Phase 8/9 domains that are frozen — see NotificationSweepService, DECISIONS.md ADR-017)
    // rather than calling NotificationsService directly, so new event types never require editing
    // the emitting service again.
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    CommonModule,
    AuditModule,
    StorageModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    ProductsModule,
    OffersModule,
    LandingsModule,
    CampaignsModule,
    CampaignMediaModule,
    DeliveryModule,
    CreatorApplicationsModule,
    CreatorProfileModule,
    ReferralsModule,
    ContentModule,
    PromoCodesModule,
    OrdersModule,
    PaymentsModule,
    CheckoutModule,
    CommissionsModule,
    PayoutMethodsModule,
    PayoutsModule,
    NotificationsModule,
    OnboardingModule,
    AdminCreatorsModule,
    AdminPaymentsModule,
    AdminRefundsModule,
    SettingsModule,
    AdminAuditModule,
    AnalyticsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule {}
