import mongoose from "mongoose";

/**
 * Crée les index déclarés dans les schémas (autoIndex est désactivé).
 * Importer depuis `lib/db` pour que tous les modèles soient chargés.
 * N'en supprime aucun, contrairement à `syncIndexes`. Continue si un modèle
 * échoue (ex. index manuel sur les mêmes clés avec d'autres options dans Atlas)
 * et renvoie la liste des échecs.
 */
export async function ensureIndexes() {
  const failures: { model: string; error: string }[] = [];
  for (const m of Object.values(mongoose.models)) {
    try {
      await m.createIndexes();
    } catch (err) {
      failures.push({ model: m.modelName, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return failures;
}
