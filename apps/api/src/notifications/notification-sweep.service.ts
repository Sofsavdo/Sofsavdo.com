import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval, SchedulerRegistry } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "./notifications.service";

const SWEEP_INTERVAL_NAME = "notification-sweep";

// Phase 8/9 (Orders/Payments/Commissions/Payouts) are frozen — this service discovers their
// business events by directly reading their tables (read-only, via PrismaService, exactly like
// CommissionsService.reconcileRefundedOrders reads Order without OrdersModule ever knowing about
// it) rather than those services emitting anything. It calls NotificationsService directly rather
// than going through EventEmitter2: unlike CreatorApplicationsService/AuthService (real business
// services outside this domain, which should never need to know NotificationsService exists),
// this class already lives inside NotificationsModule — routing through the event bus here would
// just be indirection for its own sake. See DECISIONS.md ADR-017.
//
// Safe to rescan the same rows every interval: NotificationsService.dispatchToCreator/
// dispatchToAdmins pass a deterministic dedupKey, and Notification.dedupKey's unique constraint
// makes a repeat dispatch for the same business event a silent no-op, never a duplicate send —
// so this never needs any cursor/"already seen" bookkeeping of its own.
@Injectable()
export class NotificationSweepService implements OnApplicationBootstrap {
  // Read by HealthController's /health/status for scheduled-job observability (Phase 14 §8/§10)
  // — a null lastRunAt just means "hasn't completed a sweep yet since boot", not a failure.
  private lastRunAt: Date | null = null;
  private lastError: string | null = null;
  // Reentrancy guard: @nestjs/schedule's @Interval fires every 30s regardless of whether the
  // previous tick has finished. Under load (large qualifying row sets, a slow DB) one sweep could
  // still be running when the next fires; overlapping runs aren't financially unsafe here (every
  // dispatch is deduped by NotificationsService's unique dedupKey), but they'd still double the
  // read load on Order/Payment/Commission/Payout for no benefit. Skipping a tick that finds the
  // previous one still in flight is simpler and safer than letting them pile up.
  private isRunning = false;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private config: ConfigService,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  getHeartbeat(): { lastRunAt: Date | null; lastError: string | null } {
    return { lastRunAt: this.lastRunAt, lastError: this.lastError };
  }

  // In test/e2e envs, this deletes the underlying JS timer @nestjs/schedule registered for
  // @Interval below — not merely a body-level "return early" guard. A live `setInterval` handle
  // keeps Node's event loop non-empty regardless of what its callback does once it fires, and
  // `moduleRef.close()` does not clear @nestjs/schedule timers on its own (a known NestJS gotcha
  // unless shutdown hooks are explicitly enabled) — which is exactly what left this interval
  // retrying (later, failing) DB queries every 30s long after an e2e run had already finished,
  // discovered via a recovered Jest log showing `Timeout._onTimeout` in schedule.explorer.js still
  // firing minutes after "Test Suites: ..." had already printed, keeping the process alive
  // indefinitely. Deleting the timer here — rather than a body-level nodeEnv check inside sweep()
  // itself — is also what lets notifications.e2e-spec.ts call `sweep.sweep()` directly and get
  // real, un-short-circuited behavior: a body-level guard would have silently no-op'd those calls
  // too, since it can't distinguish "the @Interval fired automatically" from "a test called this
  // method directly".
  //
  // Must run in onApplicationBootstrap, not onModuleInit: @nestjs/schedule's own ScheduleExplorer
  // registers every @Interval/@Cron into SchedulerRegistry from its *own* onModuleInit hook, and
  // onModuleInit hooks across an application do not run in any guaranteed cross-module order — this
  // one raced ScheduleExplorer's and sometimes ran first, so schedulerRegistry.deleteInterval threw
  // "No Interval was found" (confirmed by running this test in isolation with --verbose).
  // onApplicationBootstrap is a strictly later lifecycle phase that only starts once every
  // onModuleInit in the whole application (including ScheduleExplorer's) has already resolved.
  onApplicationBootstrap(): void {
    if (this.config.get<string>("nodeEnv") === "test") {
      this.schedulerRegistry.deleteInterval(SWEEP_INTERVAL_NAME);
    }
  }

  @Interval(SWEEP_INTERVAL_NAME, 30_000)
  async sweep(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      await Promise.all([this.sweepOrders(), this.sweepPayments(), this.sweepCommissions(), this.sweepPayouts()]);
      this.lastRunAt = new Date();
      this.lastError = null;
    } catch (err) {
      this.lastError = (err as Error).message;
      throw err;
    } finally {
      this.isRunning = false;
    }
  }

  private async sweepOrders(): Promise<void> {
    const orders = await this.prisma.order.findMany({
      where: { status: { in: ["PAID", "DELIVERED"] } },
      select: {
        id: true,
        status: true,
        publicToken: true,
        totalMinor: true,
        currency: true,
        offer: { select: { name: true } },
        attribution: { select: { creatorId: true } },
      },
    });
    for (const order of orders) {
      if (!order.attribution) continue; // no attributed creator — direct/non-referred sale
      if (order.status === "PAID") {
        await this.notifications.dispatchToCreator(
          order.attribution.creatorId,
          "order.received",
          { offerName: order.offer.name, amountMinor: order.totalMinor, currency: order.currency, orderPublicToken: order.publicToken },
          `order.received:${order.id}`,
        );
      } else {
        await this.notifications.dispatchToCreator(
          order.attribution.creatorId,
          "order.delivered",
          { offerName: order.offer.name, orderPublicToken: order.publicToken },
          `order.delivered:${order.id}`,
        );
      }
    }
  }

  private async sweepPayments(): Promise<void> {
    const failed = await this.prisma.payment.findMany({
      where: { status: "FAILED" },
      select: { id: true, provider: true, amountMinor: true, currency: true, order: { select: { publicToken: true } } },
    });
    for (const payment of failed) {
      await this.notifications.dispatchToAdmins(
        "payment.failed.admin",
        { orderPublicToken: payment.order.publicToken, amountMinor: payment.amountMinor, currency: payment.currency, provider: payment.provider },
        `payment.failed.admin:${payment.id}`,
      );
    }
  }

  private async sweepCommissions(): Promise<void> {
    const commissions = await this.prisma.commission.findMany({
      where: { status: { in: ["APPROVED", "PAYABLE"] } },
      select: { id: true, status: true, creatorId: true, amountMinor: true, currency: true },
    });
    for (const c of commissions) {
      const type = c.status === "APPROVED" ? ("commission.approved" as const) : ("commission.payable" as const);
      await this.notifications.dispatchToCreator(c.creatorId, type, { amountMinor: c.amountMinor, currency: c.currency }, `${type}:${c.id}`);
    }
  }

  private async sweepPayouts(): Promise<void> {
    const payouts = await this.prisma.payout.findMany({
      where: { status: { in: ["REQUESTED", "APPROVED", "REJECTED", "PAID", "FAILED"] } },
      select: { id: true, status: true, creatorId: true, amountMinor: true, currency: true, rejectionReason: true, creator: { select: { displayName: true } } },
    });
    for (const p of payouts) {
      const vars = { amountMinor: p.amountMinor, currency: p.currency };
      switch (p.status) {
        case "REQUESTED":
          await this.notifications.dispatchToCreator(p.creatorId, "payout.requested", vars, `payout.requested:${p.id}`);
          await this.notifications.dispatchToAdmins("payout.requested.admin", { ...vars, creatorName: p.creator.displayName }, `payout.requested.admin:${p.id}`);
          break;
        case "APPROVED":
          await this.notifications.dispatchToCreator(p.creatorId, "payout.approved", vars, `payout.approved:${p.id}`);
          break;
        case "REJECTED":
          await this.notifications.dispatchToCreator(p.creatorId, "payout.rejected", { ...vars, reason: p.rejectionReason ?? "" }, `payout.rejected:${p.id}`);
          break;
        case "PAID":
          await this.notifications.dispatchToCreator(p.creatorId, "payout.paid", vars, `payout.paid:${p.id}`);
          break;
        case "FAILED":
          await this.notifications.dispatchToAdmins(
            "payout.failed.admin",
            { ...vars, creatorName: p.creator.displayName, reason: p.rejectionReason ?? "" },
            `payout.failed.admin:${p.id}`,
          );
          break;
      }
    }
  }
}
