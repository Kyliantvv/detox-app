import { connectDb, db, Prisma } from "../lib/db";

// pnpm db:ping : vérifie la connexion à la base (aller-retour avec le serveur), puis
// affiche le nombre de documents par collection. Lecture seule, rien n'est créé.
// Lancé par la CI sur la base de prod après un push sur main.

let failed = false;

try {
  await connectDb();
  const ping = (await db.$runCommandRaw({ ping: 1 })) as { ok?: number };
  if (ping.ok !== 1) throw new Error("MongoDB ne répond pas au ping");
  console.log("Connexion à MongoDB : OK");

  const counts: Record<string, number> = {};
  for (const model of Prisma.dmmf.datamodel.models) {
    const collection = model.dbName ?? model.name;
    const res = (await db.$runCommandRaw({ count: collection })) as { n: number };
    counts[collection] = res.n;
  }
  console.table(counts);
  console.log(`${Object.keys(counts).length} collections, ${counts.users ?? 0} utilisateurs.`);
} catch (error) {
  console.error(`Échec : ${error instanceof Error ? error.message : String(error)}`);
  failed = true;
} finally {
  await db.$disconnect();
}

if (failed) process.exitCode = 1;
