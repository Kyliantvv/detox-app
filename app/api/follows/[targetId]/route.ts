import { db, toId } from "@/lib/db";
import { requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { followingIds } from "@/lib/server/views";

/**
 * @openapi
 * /api/follows/{targetId}:
 *   delete:
 *     tags: [Abonnements]
 *     summary: Ne plus suivre un compte
 *     parameters:
 *       - { name: targetId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       '200': { description: Ids suivis après le désabonnement, content: { application/json: { schema: { type: object, properties: { items: { type: array, items: { type: string } } } } } } }
 *       '400': { $ref: '#/components/responses/InvalidInput' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 */
export const DELETE = route(async (request, ctx: RouteContext<"/api/follows/[targetId]">) => {
  const user = await requireUser(request);
  const { targetId } = await ctx.params;
  await db.follow.deleteMany({ where: { followerId: user.id, followingId: toId(targetId, "targetId") } });
  return json({ items: await followingIds(user.id) });
});
