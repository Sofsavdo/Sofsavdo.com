import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { seedRolesAndPermissions } from "../prisma/lib/seed-roles-permissions";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ 
  connectionString: databaseUrl,
  connectionTimeoutMillis: 30_000
});
pool.on("error", (err) => {
  console.warn(`Idle PostgreSQL connection dropped: ${err.message}`);
});

const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  console.log("Seeding roles and permissions (including launch_bonus)...");
  console.log("This will update all role permissions to match permissions.constants.ts");
  await seedRolesAndPermissions(prisma);
  console.log("\n=== COMPLETE ===");
  console.log("All permissions have been reseeded including launch_bonus permissions");
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
