import mongoose from "mongoose";
import { connectDb, ensureIndexes } from "../lib/db";

await connectDb();
try {
  const failures = await ensureIndexes();
  for (const f of failures) console.error(`${f.model} : ${f.error}`);
  if (failures.length) process.exitCode = 1;
  else console.log(`Index à jour sur ${Object.keys(mongoose.models).length} collections.`);
} finally {
  await mongoose.disconnect();
}
