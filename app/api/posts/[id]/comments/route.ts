import { addComment, db } from "@/lib/db";
import { POINTS } from "@/lib/game";
import { ApiError, json, readBody, route } from "@/lib/server/http";
import { credit, withPoints } from "@/lib/server/points";
import { userAndPost } from "@/lib/server/posts";
import { COMMENT_MAX } from "@/lib/validation";

type Ctx = RouteContext<"/api/posts/[id]/comments">;

/**
 * @openapi
 * /api/posts/{id}/comments:
 *   get:
 *     tags: [Posts]
 *     summary: Commentaires d'un post
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       '200': { description: Commentaires, du plus ancien au plus récent, content: { application/json: { schema: { type: object, properties: { items: { type: array, items: { $ref: '#/components/schemas/Comment' } } } } } } }
 *       '400': { $ref: '#/components/responses/InvalidInput' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 *   post:
 *     tags: [Posts]
 *     summary: Commenter un post
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody: { required: true, content: { application/json: { schema: { type: object, additionalProperties: false, required: [text], properties: { text: { type: string, minLength: 1, maxLength: 300 } } } } } }
 *     responses:
 *       '201': { description: Commentaire ajouté, content: { application/json: { schema: { allOf: [{ type: object, properties: { comment: { $ref: '#/components/schemas/Comment' } } }, { $ref: '#/components/schemas/PointsResponse' }] } } } }
 *       '400': { $ref: '#/components/responses/InvalidInput' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 */
export const GET = route(async (request, ctx: Ctx) => {
  const { post } = await userAndPost(request, ctx.params);
  const comments = await db.comment.findMany({
    where: { postId: post.id },
    orderBy: { createdAt: "asc" },
    select: { text: true, author: { select: { username: true } } },
  });
  return json({ items: comments.map(({ author, text }) => ({ author: author.username, text })) });
});

export const POST = route(async (request, ctx: Ctx) => {
  const { user, post } = await userAndPost(request, ctx.params);
  const { text } = await readBody(request, { text: "string" });
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > COMMENT_MAX) {
    throw new ApiError("INVALID_INPUT", `Commentaire : 1 à ${COMMENT_MAX} caractères.`);
  }
  const comment = await addComment(user.id, post.id, trimmed);
  const gains = await credit(user.id, POINTS.reaction, "comment", "Réaction", { combo: true, refId: post.id });
  return json({ comment: { author: user.username, text: comment.text }, ...(await withPoints(user.id, gains)) }, 201);
});
