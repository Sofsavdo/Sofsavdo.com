import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ExecutiveAnalyticsService } from "./executive-analytics.service";
import { CreatorAnalyticsService } from "./creator-analytics.service";
import { CampaignAnalyticsService } from "./campaign-analytics.service";
import { ProductAnalyticsService } from "./product-analytics.service";
import { PaymentAnalyticsService } from "./payment-analytics.service";
import { RefundAnalyticsService } from "./refund-analytics.service";
import { CustomerAnalyticsService } from "./customer-analytics.service";
import { AnalyticsExportService } from "./analytics-export.service";
import { AnalyticsQueryDto } from "./dto/analytics-query.dto";
import { AnalyticsExportQueryDto } from "./dto/analytics-export-query.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@ApiTags("admin/analytics")
@ApiBearerAuth("bearer")
@Controller("admin/analytics")
export class AnalyticsAdminController {
  constructor(
    private executive: ExecutiveAnalyticsService,
    private creatorAnalytics: CreatorAnalyticsService,
    private campaignAnalytics: CampaignAnalyticsService,
    private productAnalytics: ProductAnalyticsService,
    private paymentAnalytics: PaymentAnalyticsService,
    private refundAnalytics: RefundAnalyticsService,
    private customerAnalytics: CustomerAnalyticsService,
    private exportService: AnalyticsExportService,
  ) {}

  @RequirePermissions("analytics.read")
  @Get("executive")
  getExecutive(@Query() query: AnalyticsQueryDto) {
    return this.executive.getSummary(query);
  }

  @RequirePermissions("analytics.read")
  @Get("creators")
  listCreators(@Query() query: AnalyticsQueryDto) {
    return this.creatorAnalytics.list(query);
  }

  @RequirePermissions("analytics.read")
  @Get("creators/:id")
  getCreator(@Param("id") id: string, @Query() query: AnalyticsQueryDto) {
    return this.creatorAnalytics.detail(id, query);
  }

  @RequirePermissions("analytics.read")
  @Get("campaigns")
  listCampaigns(@Query() query: AnalyticsQueryDto) {
    return this.campaignAnalytics.list(query);
  }

  @RequirePermissions("analytics.read")
  @Get("campaigns/:id")
  getCampaign(@Param("id") id: string, @Query() query: AnalyticsQueryDto) {
    return this.campaignAnalytics.detail(id, query);
  }

  @RequirePermissions("analytics.read")
  @Get("products")
  listProducts(@Query() query: AnalyticsQueryDto) {
    return this.productAnalytics.list(query);
  }

  @RequirePermissions("analytics.read")
  @Get("products/:id")
  getProduct(@Param("id") id: string, @Query() query: AnalyticsQueryDto) {
    return this.productAnalytics.detail(id, query);
  }

  @RequirePermissions("analytics.read")
  @Get("payments")
  getPayments(@Query() query: AnalyticsQueryDto) {
    return this.paymentAnalytics.getSummary(query);
  }

  @RequirePermissions("analytics.read")
  @Get("refunds")
  getRefunds(@Query() query: AnalyticsQueryDto) {
    return this.refundAnalytics.getSummary(query);
  }

  @RequirePermissions("analytics.read")
  @Get("customers")
  getCustomers(@Query() query: AnalyticsQueryDto) {
    return this.customerAnalytics.getSummary(query);
  }

  // Requires BOTH keys ("AND, not OR" — RBAC.md's existing rule) — in practice unchanged from
  // requiring analytics.export alone, since no role in DEFAULT_ROLE_PERMISSIONS has export
  // without also having read, but stated explicitly since the read guard is what every other
  // route in this controller also enforces.
  // Phase 14 finding: an export computes and serializes a full CSV (potentially every row of a
  // list view) — meaningfully more expensive per-request than a normal paginated read, and
  // explicitly named in the Phase 14 spec as a route that needs its own stricter limit rather
  // than relying on the global default.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequirePermissions("analytics.read", "analytics.export")
  @Get("export")
  async export(@Query() query: AnalyticsExportQueryDto, @CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    const result = await this.exportService.export(query, user.userId);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return result.content;
  }
}
