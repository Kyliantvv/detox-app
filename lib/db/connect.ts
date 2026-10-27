import mongoose from "mongoose";
import { missingIndexes } from "./indexes";

// Survit au hot reload de `next dev`, qui réévalue les modules.
const cache = globalThis as unknown as { mongoose?: Promise<typeof mongoose> };

export function mongoUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI manquant (voir .env.example)");
  return uri;
}

export function connectDb() {
  const uri = mongoUri();

  // En dev, Mongoose crée les index tout seul. En prod, pas de createIndex à
  // chaque démarrage à froid : `pnpm db:indexes` les crée, et on refuse de
  // démarrer s'il en manque, car les index uniques portent des règles métier
  // (une page de Flow créditée une fois, un like par post, une conversation par paire).
  const prod = process.env.NODE_ENV === "production";
  cache.mongoose ??= mongoose
    .connect(uri, { autoIndex: !prod })
    .then(async (m) => {
      if (prod) {
        const missing = await missingIndexes();
        if (missing.length) {
          await m.disconnect();
          throw new Error(`Index manquants sur ${missing.map((x) => x.model).join(", ")} : lancer \`pnpm db:indexes\``);
        }
      }
      return m;
    })
    .catch((err) => {
      cache.mongoose = undefined;
      throw err;
    });
  return cache.mongoose;
}
