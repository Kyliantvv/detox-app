import mongoose from "mongoose";
import { ALL_MODELS, ensureIndexes } from "../lib/db";

// Connexion directe : connectDb refuse de démarrer en prod s'il manque des index.
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI manquant (voir .env.example)");
await mongoose.connect(uri, { autoIndex: false });
try {
  const failures = await ensureIndexes();
  for (const f of failures) console.error(`${f.model} : ${f.error}`);
  if (failures.length) process.exitCode = 1;
  else console.log(`Index à jour sur ${ALL_MODELS.length} collections.`);
} finally {
  await mongoose.disconnect();
}
