import { auth } from "@/auth";
import { db, toId } from "@/lib/db";
import { requireUser } from "@/lib/server/auth";
import { errorResponse, route } from "@/lib/server/http";

/**
 * @openapi
 * /api/media/{id}:
 *   get:
 *     tags: [Posts]
 *     summary: Fichier d'un post
 *     description: Accepte le Bearer ou le cookie de session NextAuth, parce qu'une balise `<img>` n'envoie pas de Bearer.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       '200': { description: Le fichier, content: { 'image/*': { schema: { type: string, format: binary } }, 'video/*': { schema: { type: string, format: binary } } } }
 *       '400': { $ref: '#/components/responses/InvalidInput' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 */
// Médias publiés, gardés dans MongoDB (collection media).
// Une balise <img> n'envoie pas de Bearer : on accepte aussi le cookie de session NextAuth.
export const GET = route(async (request, ctx: RouteContext<"/api/media/[id]">) => {
  if (!(await auth())) await requireUser(request);
  const { id } = await ctx.params;
  const media = await db.media.findUnique({ where: { id: toId(id, "Média") } });
  if (!media) return errorResponse("NOT_FOUND", "Média introuvable.");
  return new Response(new Blob([media.data as BlobPart], { type: media.mime }), {
    headers: { "Cache-Control": "private, max-age=31536000, immutable" },
  });
});
