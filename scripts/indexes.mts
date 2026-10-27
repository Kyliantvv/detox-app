import { db, ensureIndexes, missingIndexes } from "../lib/db";

// Lancé par `pnpm db:indexes`, après `prisma db push` qui crée les index du schéma.
try {
  const failures = await ensureIndexes();
  for (const f of failures) console.error(`${f.collection}.${f.index} : ${f.error}`);
  const missing = await missingIndexes();
  for (const m of missing) console.error(`${m.collection} : index manquants ${m.indexes.join(", ")}`);
  if (failures.length || missing.length) process.exitCode = 1;
  else console.log("Index à jour.");
} finally {
  await db.$disconnect();
}
