import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Prisma 7 driver-adapter pattern — mirrors prisma.config.ts exactly so the CLI (migrate/studio)
// and the running app never disagree about how they connect. See DECISIONS.md.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private pool: Pool;

  constructor(config: ConfigService) {
    const databaseUrl = config.get<string>("databaseUrl")!;
    // `pg`'s own default is `connectionTimeoutMillis: 0` — no timeout at all, so a stalled
    // handshake against a flaky/proxied remote Postgres (observed against this project's Railway
    // instance more than once) waits forever instead of failing. 10s surfaces that as a clear,
    // bounded P1001/DatabaseNotReachable error instead of an indefinite hang.
    const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 10_000 });
    // Without an "error" listener, an idle pooled connection dropped by the server (routine with
    // a remote/proxied Postgres — observed live against Railway during 6B verification) emits an
    // unhandled "error" event and crashes the entire Node process. node-postgres documents this
    // exact handler as mandatory; the client that died is discarded and the pool replaces it on
    // the next checkout.
    pool.on("error", (err) => {
      new Logger(PrismaService.name).warn(`Idle PostgreSQL connection dropped: ${err.message}`);
    });
    super({ adapter: new PrismaPg(pool) });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log("Connected to PostgreSQL");
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
