import { db } from "@/lib/db";
import { requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { visibleWhere } from "@/lib/server/posts";
import { postViews } from "@/lib/server/views";

const LIMIT = 50;

/**
 * @openapi
 * /api/feed/circle:
 *   get:
 *     tags: [Fil]
 *     summary: Mon cercle
 *     description: Photos des comptes suivis et les miennes, du plus récent au plus ancien (50 au plus).
 *     responses:
 *       '200': { description: Posts du cercle, content: { application/json: { schema: { type: object, properties: { items: { type: array, items: { $ref: '#/components/schemas/PostView' } } } } } } }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 */
// Mon cercle : posts des comptes suivis et les miens, du plus récent au plus ancien.
export const GET = route(async (request) => {
  const user = await requireUser(request);
  const follows = await db.follow.findMany({ where: { followerId: user.id }, select: { followingId: true } });
  const authors = [user.id, ...follows.map((follow) => follow.followingId)];
  const posts = await db.post.findMany({
    where: { AND: [{ type: "photo", authorId: { in: authors } }, await visibleWhere(user.id)] },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
  });
  return json({ items: await postViews(posts, user.id) });
});
