import { Module } from "@nestjs/common";
import { AnalyticsAdminController } from "./analytics-admin.controller";
import { ExecutiveAnalyticsService } from "./executive-analytics.service";
import { CreatorAnalyticsService } from "./creator-analytics.service";
import { CampaignAnalyticsService } from "./campaign-analytics.service";
import { ProductAnalyticsService } from "./product-analytics.service";
import { PaymentAnalyticsService } from "./payment-analytics.service";
import { RefundAnalyticsService } from "./refund-analytics.service";
import { CustomerAnalyticsService } from "./customer-analytics.service";
import { AnalyticsExportService } from "./analytics-export.service";
import { AnalyticsCacheService } from "./lib/analytics-cache.service";

// Read-only against every other domain's tables (Order/Payment/Refund/Commission/Campaign/
// Attribution/ReferralVisit/CreatorProfile/Customer) — no other module's service is imported here,
// since nothing in this domain mutates business data (the one write, AuditService.record for
// exports, comes from the already-@Global AuditModule). See ANALYTICS.md §5, DECISIONS.md ADR-020.
@Module({
  controllers: [AnalyticsAdminController],
  providers: [
    AnalyticsCacheService,
    ExecutiveAnalyticsService,
    CreatorAnalyticsService,
    CampaignAnalyticsService,
    ProductAnalyticsService,
    PaymentAnalyticsService,
    RefundAnalyticsService,
    CustomerAnalyticsService,
    AnalyticsExportService,
  ],
})
export class AnalyticsModule {}
