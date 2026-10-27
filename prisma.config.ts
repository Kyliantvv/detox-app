import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Avec ce fichier, la CLI Prisma ne lit plus `.env` : on charge `.env.local`,
// comme `next dev` et les scripts `pnpm db:*`.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({ schema: "prisma/schema.prisma" });
