import mongoose from "mongoose";

// Survit au hot reload de `next dev`, qui réévalue les modules.
const cache = globalThis as unknown as { mongoose?: Promise<typeof mongoose> };

export function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI manquant (voir .env.example)");

  // Pas de createIndex à chaque démarrage à froid : les index se créent
  // avec `pnpm db:indexes` (voir lib/db/indexes.ts).
  cache.mongoose ??= mongoose.connect(uri, { autoIndex: false }).catch((err) => {
    cache.mongoose = undefined;
    throw err;
  });
  return cache.mongoose;
}
