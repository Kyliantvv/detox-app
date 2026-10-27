import mongoose from "mongoose";
import { ALL_MODELS, ensureIndexes, mongoUri } from "../lib/db";

// Connexion directe : connectDb refuse de démarrer en prod s'il manque des index.
await mongoose.connect(mongoUri(), { autoIndex: false });
try {
  const failures = await ensureIndexes();
  for (const f of failures) console.error(`${f.model} : ${f.error}`);
  if (failures.length) process.exitCode = 1;
  else console.log(`Index à jour sur ${ALL_MODELS.length} collections.`);
} finally {
  await mongoose.disconnect();
}
