import { createRouteHandler } from "files-sdk/next";
import { db } from "@/lib/db";
import { getFiles } from "@/lib/files";
import { requireUser } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/http";
import { createUploadRouter } from "@/lib/upload-router";

let handlers: ReturnType<typeof createRouteHandler> | undefined;

// Même Bearer que le reste de l'API. Une autre erreur (base injoignable) remonte en 500.
async function authenticate(request: Request) {
  try {
    return (await requireUser(request)).id;
  } catch (error) {
    if (error instanceof ApiError) return null;
    throw error;
  }
}

// Built on first request, not at import: the router needs FILES_API_SECRET,
// which `next build` shouldn't require.
const getHandlers = () =>
  (handlers ??= createRouteHandler(
    createUploadRouter(getFiles, {
      authenticate,
      // Lie la clé à son auteur : POST /api/posts n'accepte que ses propres fichiers.
      // upsert : un « complete » rejoué ne crée pas de doublon. `usedAt: null` écrit le
      // champ : sur MongoDB, le filtre `usedAt: null` de POST /api/posts ignore un champ absent.
      onUpload: async (file, ownerId) => {
        await db.media.upsert({
          where: { key: file.key },
          create: { key: file.key, ownerId, mime: file.contentType, size: file.size, usedAt: null },
          update: {},
        });
      },
    }),
  ));

/**
 * @openapi
 * /api/files:
 *   post:
 *     tags: [Fichiers]
 *     summary: Préparer puis valider un téléversement (protocole files-sdk)
 *     description: >-
 *       `{"op":"presign","files":[{name,type,size}]}` renvoie la clé et l'URL du PUT ;
 *       `{"op":"complete","completions":[{id,key}]}` vérifie le fichier et le lie au compte.
 *       Images (AVIF, GIF, JPEG, PNG, WebP) ou vidéos (MP4, WebM), 4 Mo maximum.
 *       La clé obtenue se passe ensuite à POST /api/posts.
 *     responses:
 *       '200': { description: Réponse du routeur files-sdk }
 *       '401': { description: Bearer manquant ou invalide }
 *   put:
 *     tags: [Fichiers]
 *     summary: Envoyer le fichier (URL rendue par presign)
 *     description: Authentifié par le jeton signé de presign, sans Bearer.
 *     security: []
 *     responses:
 *       '200': { description: Réponse du routeur files-sdk }
 */
export const POST = (req: Request) => getHandlers().POST(req);
export const PUT = (req: Request) => getHandlers().PUT(req);
