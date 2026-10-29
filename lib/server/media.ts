import "server-only";
import { db, inTransaction } from "@/lib/db";
import { getFiles } from "@/lib/files";
import { UPLOAD_TYPES } from "@/lib/media-types";
import { ApiError, assertId } from "@/lib/server/http";
import type { MessageMedia } from "@/lib/types";

type Accept = {
  /** Types acceptés ici (tout ce que /api/files accepte par défaut). */
  types?: readonly string[];
  /** Message d'erreur quand un fichier n'a pas l'un de ces types. */
  refused?: string;
};

// Réserve des fichiers envoyés par /api/files : seul leur auteur les utilise, et une seule fois
// (un post ou un message). Tout ou rien : un fichier refusé ne réserve pas les autres.
// Renvoie, dans l'ordre des clés, l'URL publique du CDN et le type de chaque fichier.
export async function claimMedia(
  userId: string,
  mediaKeys: string[],
  at: Date,
  { types = UPLOAD_TYPES, refused = "Format refusé." }: Accept = {},
): Promise<MessageMedia[]> {
  const keys = mediaKeys.map((key) => assertId(key, "mediaKey"));
  if (new Set(keys).size !== keys.length) throw new ApiError("INVALID_INPUT", "Un même média est joint deux fois.");
  const rows = await db.media.findMany({ where: { key: { in: keys }, ownerId: userId, usedAt: null } });
  if (rows.length !== keys.length) throw new ApiError("NOT_FOUND", "Média introuvable ou déjà publié.");
  if (rows.some((row) => !types.includes(row.mime))) throw new ApiError("INVALID_INPUT", refused);
  await inTransaction(undefined, async (tx) => {
    const claimed = await tx.media.updateMany({ where: { key: { in: keys }, usedAt: null }, data: { usedAt: at } });
    // Réservé entre-temps par une autre requête : la transaction est annulée.
    if (claimed.count !== keys.length) throw new ApiError("NOT_FOUND", "Média introuvable ou déjà publié.");
  });
  const mimes = new Map(rows.map((row) => [row.key, row.mime]));
  return Promise.all(keys.map(async (key) => ({ url: await getFiles().url(key), mime: mimes.get(key)! })));
}
