import { afterAll, beforeEach } from "vitest";

// Chaque test repart de la maquette (scripts/scenario.ts) sur une base vidée.
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI;

const { resetDb } = await import("./db");
const { db } = await import("../lib/db");

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.$disconnect();
});
