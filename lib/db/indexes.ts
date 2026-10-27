import { ALL_MODELS } from "./models";

/**
 * Crée les index déclarés dans les schémas. N'en supprime aucun, contrairement
 * à `syncIndexes`. Continue si un modèle échoue (ex. index manuel sur les mêmes
 * clés avec d'autres options dans Atlas) et renvoie la liste des échecs.
 */
export async function ensureIndexes() {
  const failures: { model: string; error: string }[] = [];
  for (const m of ALL_MODELS) {
    try {
      await m.createIndexes();
    } catch (err) {
      failures.push({ model: m.modelName, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return failures;
}

/** Index déclarés mais absents de la base, par modèle. */
export async function missingIndexes() {
  const missing: { model: string; indexes: string[] }[] = [];
  for (const m of ALL_MODELS) {
    const { toCreate } = await m.diffIndexes();
    if (toCreate.length) missing.push({ model: m.modelName, indexes: toCreate.map((i) => JSON.stringify(i)) });
  }
  return missing;
}
