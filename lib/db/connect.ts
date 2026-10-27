import { db } from "./client";
import { missingIndexes } from "./indexes";

const cache = globalThis as unknown as { dbReady?: Promise<typeof db> };

export function mongoUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI manquant (voir .env.example)");
  return uri;
}

/**
 * Connecte le client une fois par process et le renvoie. En prod, refuse de
 * démarrer s'il manque des index : les index uniques portent des règles
 * métier (une page de Flow créditée une fois, un like par post, une
 * conversation par paire). `pnpm db:indexes` les crée.
 */
export function connectDb() {
  mongoUri();
  cache.dbReady ??= (async () => {
    await db.$connect();
    if (process.env.NODE_ENV === "production") {
      const missing = await missingIndexes();
      if (missing.length) {
        throw new Error(`Index manquants sur ${missing.map((x) => x.collection).join(", ")} : lancer \`pnpm db:indexes\``);
      }
    }
    return db;
  })().catch((err: unknown) => {
    cache.dbReady = undefined;
    throw err;
  });
  return cache.dbReady;
}
