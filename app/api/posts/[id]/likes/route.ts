import { db, likePost, unlikePost } from "@/lib/db";
import { POINTS } from "@/lib/game";
import { json, route } from "@/lib/server/http";
import { credit, withPoints } from "@/lib/server/points";
import { userAndPost } from "@/lib/server/posts";

type Ctx = RouteContext<"/api/posts/[id]/likes">;

const doses = async (postId: string) => {
  const post = await db.post.findUniqueOrThrow({ where: { id: postId }, select: { baseLikes: true, likesCount: true } });
  return post.baseLikes + post.likesCount;
};

/**
 * @openapi
 * /api/posts/{id}/likes:
 *   post:
 *     tags: [Posts]
 *     summary: Donner une Bonne dose
 *     description: Idempotent, les points ne sont crédités qu'à la première.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       '200': { description: Compteur à jour, content: { application/json: { schema: { allOf: [{ type: object, properties: { doses: { type: integer }, dosedByMe: { type: boolean } } }, { $ref: '#/components/schemas/PointsResponse' }] } } } }
 *       '400': { $ref: '#/components/responses/InvalidInput' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Posts]
 *     summary: Retirer ma Bonne dose
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       '200': { description: Compteur à jour, content: { application/json: { schema: { type: object, properties: { doses: { type: integer }, dosedByMe: { type: boolean } } } } } }
 *       '400': { $ref: '#/components/responses/InvalidInput' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 */
// Bonne dose : idempotente, les points ne sont crédités qu'à la première.
export const POST = route(async (request, ctx: Ctx) => {
  const { user, post } = await userAndPost(request, ctx.params);
  const gains = (await likePost(user.id, post.id))
    ? await credit(user.id, POINTS.dose, "like", "Bonne dose donnée", { combo: true, refId: post.id })
    : [];
  return json({ doses: await doses(post.id), dosedByMe: true, ...(await withPoints(user.id, gains)) });
});

export const DELETE = route(async (request, ctx: Ctx) => {
  const { user, post } = await userAndPost(request, ctx.params);
  await unlikePost(user.id, post.id);
  return json({ doses: await doses(post.id), dosedByMe: false });
});
