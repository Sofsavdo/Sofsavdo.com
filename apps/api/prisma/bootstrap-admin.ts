// Production-safe counterpart to seed.ts. seed.ts refuses to run at all once NODE_ENV=production
// (see its own guard) because it creates demo creators/campaigns/promo codes and gives every
// account one shared, publicly-known password — none of that belongs anywhere near a real
// database. But that guard left a real gap: a fresh production database has an empty Role/
// Permission/RolePermission catalog (RBAC has nothing to check against) and no way to create the
// very first admin account, since every staff-creation path in the app (POST /admin/users) itself
// requires an existing user.manage permission — a chicken-and-egg problem. This script is the
// one-time, manual answer: run once per environment, after migrations, before real operator use.
//
// Usage (see RUNBOOK.md for the full launch procedure):
//   BOOTSTRAP_ADMIN_EMAIL=you@company.com BOOTSTRAP_ADMIN_PASSWORD='...' \
//     npm run bootstrap:admin --workspace=@sofsavdo/api
//
// Safe to run more than once: seeding roles/permissions is idempotent (upserts), and if a
// super_admin user already exists, this refuses to create another one unless
// BOOTSTRAP_ALLOW_ADDITIONAL_ADMIN=true is explicitly set — prevents an accidental second run
// (e.g. a copy-pasted command in a runbook) from silently minting extra admin accounts nobody
// asked for. Never logs the password.
import "reflect-metadata";
import * as argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { seedRolesAndPermissions } from "./lib/seed-roles-permissions";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must both be set. See RUNBOOK.md.");
  }
  if (password.length < 12) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters — this account has every permission in the system.");
  }

  console.log("Seeding permission catalog and default roles (idempotent — safe to re-run)...");
  await seedRolesAndPermissions(prisma);

  const existingSuperAdmin = await prisma.userRole.findFirst({ where: { role: { key: "super_admin" } }, include: { user: { select: { email: true } } } });
  if (existingSuperAdmin && process.env.BOOTSTRAP_ALLOW_ADDITIONAL_ADMIN !== "true") {
    throw new Error(
      `A super_admin account already exists (${existingSuperAdmin.user.email ?? existingSuperAdmin.userId}). ` +
        "Refusing to create another one — use the admin User Management UI to add staff from here on. " +
        "If you genuinely intend to bootstrap a second super_admin (e.g. disaster recovery), set BOOTSTRAP_ALLOW_ADDITIONAL_ADMIN=true.",
    );
  }

  const role = await prisma.role.findUniqueOrThrow({ where: { key: "super_admin" } });
  const passwordHash = await argon2.hash(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, emailVerified: new Date(), status: "ACTIVE" },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  console.log(`\n=== BOOTSTRAP COMPLETE ===`);
  console.log(`Super admin account ready: ${email}`);
  console.log("Log in and, if this is a real launch, rotate this password immediately from the account settings.");
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
