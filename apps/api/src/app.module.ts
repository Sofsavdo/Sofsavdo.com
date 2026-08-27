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
import { UploadsModule } from "./uploads/uploads.module";
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
import { ChatModule } from "./chat/chat.module";
import { AdminPaymentsModule } from "./admin-payments/admin-payments.module";
import { AdminRefundsModule } from "./admin-refunds/admin-refunds.module";
import { SettingsModule } from "./settings/settings.module";
import { AdminAuditModule } from "./admin-audit/admin-audit.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { SavedProductsModule } from "./saved-products/saved-products.module";
import { BuyerAddressesModule } from "./buyer-addresses/buyer-addresses.module";
import { HomepageModule } from "./homepage/homepage.module";
import { ProductAiModule } from "./product-ai/product-ai.module";
import { CreatorDashboardModule } from "./creator-dashboard/creator-dashboard.module";
import { CreatorLeaderboardModule } from "./creator-leaderboard/creator-leaderboard.module";
import { CompetitionsModule } from "./competitions/competitions.module";
import { AdminDashboardModule } from "./admin-dashboard/admin-dashboard.module";
import { AdminReferralLinksModule } from "./admin-referral-links/admin-referral-links.module";
import { ActivityTickerModule } from "./activity-ticker/activity-ticker.module";
import { CreatorFundModule } from "./creator-fund/creator-fund.module";
import { PublicActivityModule } from "./public-activity/public-activity.module";
import { LaunchBonusModule } from "./launch-bonus/launch-bonus.module";
import { FlowsModule } from "./flows/flows.module";
import { FidemIntegrationModule } from "./fidem-integration/fidem-integration.module";
import { IzdoshIntegrationModule } from "./izdosh-integration/izdosh-integration.module";
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
    UploadsModule,
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
    ChatModule,
    AdminPaymentsModule,
    AdminRefundsModule,
    SettingsModule,
    AdminAuditModule,
    AnalyticsModule,
    SavedProductsModule,
    BuyerAddressesModule,
    HomepageModule,
    ProductAiModule,
    CreatorDashboardModule,
    CreatorLeaderboardModule,
    CompetitionsModule,
    FidemIntegrationModule,
    IzdoshIntegrationModule,
    AdminDashboardModule,
    AdminReferralLinksModule,
    ActivityTickerModule,
    CreatorFundModule,
    PublicActivityModule,
    LaunchBonusModule,
    FlowsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule {}
