import "server-only";
import { db } from "@/lib/db";
import { getFiles } from "@/lib/files";
import { ApiError, assertId } from "@/lib/server/http";

// Réserve un fichier envoyé par /api/files : seul son auteur l'utilise, et une seule fois
// (un post ou un message). Renvoie l'URL publique du CDN et le type du fichier.
export async function claimMedia(userId: string, mediaKey: string, at: Date) {
  const key = assertId(mediaKey, "mediaKey");
  const claimed = await db.media.updateMany({ where: { key, ownerId: userId, usedAt: null }, data: { usedAt: at } });
  if (!claimed.count) throw new ApiError("NOT_FOUND", "Média introuvable ou déjà publié.");
  const media = await db.media.findUniqueOrThrow({ where: { key } });
  return { url: await getFiles().url(key), mime: media.mime };
}
