import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Avec ce fichier, la CLI Prisma ne charge plus `.env` d'elle-même. On charge
// `.env.local` puis `.env`, comme `next dev` et les scripts `pnpm db:*` :
// une variable déjà définie (environnement, puis `.env.local`) n'est pas écrasée.
for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);

export default defineConfig({ schema: "prisma/schema.prisma" });
