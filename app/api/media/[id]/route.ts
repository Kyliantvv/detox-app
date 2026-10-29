import { auth } from "@/auth";
import { db, toId } from "@/lib/db";
import { requireUser } from "@/lib/server/auth";
import { errorResponse, route } from "@/lib/server/http";
import { mediaHeaders } from "@/lib/server/media";
import { visibleWhere } from "@/lib/server/posts";

/**
 * @openapi
 * /api/media/{id}:
 *   get:
 *     tags: [Posts]
 *     summary: Fichier d'un post
 *     description: Accepte le Bearer ou le cookie de session NextAuth, parce qu'une balise `<img>` n'envoie pas de Bearer. Répond 404 si le post du média est invisible pour ce compte (cercle proche).
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
  const viewerId = (await auth())?.user?.id ?? (await requireUser(request)).id;
  const { id } = await ctx.params;
  const mediaId = toId(id, "Média");
  // Même visibilité que le post : un média du cercle proche reste dans le cercle proche.
  const [media, post] = await Promise.all([
    db.media.findUnique({ where: { id: mediaId } }),
    db.post.findFirst({ where: { AND: [{ mediaPath: `/api/media/${mediaId}` }, await visibleWhere(viewerId)] }, select: { id: true } }),
  ]);
  if (!media || !post) return errorResponse("NOT_FOUND", "Média introuvable.");
  return new Response(new Blob([media.data as BlobPart]), { headers: mediaHeaders(media.mime, media.data.length) });
});
