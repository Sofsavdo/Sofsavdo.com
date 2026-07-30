// Automatic, idempotent admin bootstrap — runs as part of the deploy pipeline's pre-deploy step
// (see .railway.json / apps/api/railway.toml), right after `prisma migrate deploy`. Unlike
// prisma/bootstrap-admin.ts (a manual, one-shot, env-var-driven procedure documented in
// RUNBOOK.md §2), this script has no external inputs and no "refuse if one already exists" guard:
// it exists specifically so the two named operator accounts below always exist, with the right
// role, on every single deploy — dev, staging, and production alike — without anyone needing to
// run a manual command or touch psql (which isn't available in the runtime container at all).
//
// Safe to run every deploy: every write here is an upsert keyed on a stable, unique field (role
// key, user email, or the userId_roleId composite), so re-running it against a database that
// already has these rows simply confirms/refreshes them rather than erroring or duplicating data.
import "reflect-metadata";
import * as argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { seedRolesAndPermissions } from "../prisma/lib/seed-roles-permissions";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// Fixed, known operator accounts — intentionally not environment-driven. Both must exist and be
// able to log in immediately after a fresh deploy, with no manual database intervention.
const ADMIN_ACCOUNTS: { email: string; password: string }[] = [
  { email: "admin@sofsavdo.com", password: "Sofsavdo#2026dev" },
  { email: "medik@sofsavdo.com", password: "Medik9298" },
];

async function main() {
  console.log("Seeding permission catalog and default roles (idempotent — safe to re-run)...");
  await seedRolesAndPermissions(prisma);

  const role = await prisma.role.findUniqueOrThrow({ where: { key: "super_admin" } });

  for (const account of ADMIN_ACCOUNTS) {
    const passwordHash = await argon2.hash(account.password);
    const user = await prisma.user.upsert({
      where: { email: account.email },
      // Every deploy re-asserts the known password hash — this script is the source of truth for
      // these two operator accounts, not a "create once and leave alone" seed.
      update: { passwordHash, status: "ACTIVE" },
      create: { email: account.email, passwordHash, emailVerified: new Date(), status: "ACTIVE" },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
    console.log(`Ensured super_admin account: ${account.email}`);
  }

  console.log("\n=== ADMIN SEED COMPLETE ===");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
