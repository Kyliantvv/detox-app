import { json, route } from "@/lib/server/http";
import { userAndPost } from "@/lib/server/posts";
import { postView } from "@/lib/server/views";

type Ctx = RouteContext<"/api/posts/[id]">;

/**
 * @openapi
 * /api/posts/{id}:
 *   get:
 *     tags: [Posts]
 *     summary: Un post
 *     description: Un post réservé au cercle proche répond 404 hors de ce cercle.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       '200': { description: Le post, content: { application/json: { schema: { type: object, properties: { post: { $ref: '#/components/schemas/PostView' } } } } } }
 *       '400': { $ref: '#/components/responses/InvalidInput' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 */
export const GET = route(async (request, ctx: Ctx) => {
  const { user, post } = await userAndPost(request, ctx.params);
  return json({ post: await postView(post, user.id) });
});
