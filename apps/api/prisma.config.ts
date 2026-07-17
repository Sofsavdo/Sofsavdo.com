import path from "node:path";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  // NestJS's own PrismaClient instantiation (src/prisma/prisma.service.ts) uses this
  // same adapter with the same env var — kept in one place so local `prisma migrate`/
  // `prisma studio` and the running app never disagree about how they connect.
  adapter: async () => {
    const { Pool } = await import("pg");
    return new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }));
  },
});
