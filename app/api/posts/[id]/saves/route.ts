import { db, isDuplicateKey } from "@/lib/db";
import { json, route } from "@/lib/server/http";
import { userAndPost } from "@/lib/server/posts";

type Ctx = RouteContext<"/api/posts/[id]/saves">;

/**
 * @openapi
 * /api/posts/{id}/saves:
 *   post:
 *     tags: [Posts]
 *     summary: Enregistrer un post
 *     description: Idempotent.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       '200': { description: Post enregistré, content: { application/json: { schema: { type: object, properties: { savedByMe: { type: boolean } } } } } }
 *       '400': { $ref: '#/components/responses/InvalidInput' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Posts]
 *     summary: Retirer un post de mes enregistrements
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       '200': { description: Enregistrement retiré, content: { application/json: { schema: { type: object, properties: { savedByMe: { type: boolean } } } } } }
 *       '400': { $ref: '#/components/responses/InvalidInput' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 */
export const POST = route(async (request, ctx: Ctx) => {
  const { user, post } = await userAndPost(request, ctx.params);
  try {
    await db.save.create({ data: { userId: user.id, postId: post.id, createdAt: new Date() } });
  } catch (error) {
    // Déjà enregistré : idempotent.
    if (!isDuplicateKey(error)) throw error;
  }
  return json({ savedByMe: true });
});

export const DELETE = route(async (request, ctx: Ctx) => {
  const { user, post } = await userAndPost(request, ctx.params);
  await db.save.deleteMany({ where: { userId: user.id, postId: post.id } });
  return json({ savedByMe: false });
});
