import { createRouteHandler } from "files-sdk/next";
import { getFiles } from "@/lib/files";
import { createUploadRouter } from "@/lib/upload-router";

let handlers: ReturnType<typeof createRouteHandler> | undefined;

// Built on first request, not at import: the router needs FILES_API_SECRET,
// which `next build` shouldn't require.
const getHandlers = () =>
  (handlers ??= createRouteHandler(createUploadRouter(getFiles)));

/**
 * @openapi
 * /api/files:
 *   get:
 *     tags: [Fichiers]
 *     summary: URL d'un fichier téléversé
 *     description: Géré par files-sdk (UploadThing). Images uniquement, 4 Mo maximum. Pas encore relié aux posts.
 *     security: []
 *     responses:
 *       '200': { description: Réponse du routeur files-sdk }
 *   post:
 *     tags: [Fichiers]
 *     summary: Préparer un téléversement
 *     security: []
 *     responses:
 *       '200': { description: Réponse du routeur files-sdk }
 *   put:
 *     tags: [Fichiers]
 *     summary: Téléverser un fichier
 *     security: []
 *     responses:
 *       '200': { description: Réponse du routeur files-sdk }
 */
export const GET = (req: Request) => getHandlers().GET(req);
export const POST = (req: Request) => getHandlers().POST(req);
export const PUT = (req: Request) => getHandlers().PUT(req);
