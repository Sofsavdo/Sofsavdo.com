import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
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
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import configuration from "./config/configuration";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
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
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
