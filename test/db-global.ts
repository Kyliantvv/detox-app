import { execFileSync } from "node:child_process";

// Une fois par lancement : schéma et index sur la base de test (TEST_MONGODB_URI, nom en *_test).
export default async function setup() {
  const uri = process.env.TEST_MONGODB_URI!;
  if (!new URL(uri).pathname.endsWith("_test")) throw new Error("TEST_MONGODB_URI doit viser une base *_test");
  process.env.MONGODB_URI = uri;
  execFileSync("pnpm", ["exec", "prisma", "db", "push", "--skip-generate"], { env: process.env, stdio: "ignore" });
  const { db, ensureIndexes } = await import("../lib/db");
  try {
    const failures = await ensureIndexes();
    if (failures.length) throw new Error(JSON.stringify(failures));
  } finally {
    await db.$disconnect();
  }
}
