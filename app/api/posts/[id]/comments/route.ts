import { addComment, db } from "@/lib/db";
import { POINTS } from "@/lib/game";
import { ApiError, json, readBody, route } from "@/lib/server/http";
import { credit, withPoints } from "@/lib/server/points";
import { userAndPost } from "@/lib/server/posts";
import { COMMENT_MAX } from "@/lib/validation";

type Ctx = RouteContext<"/api/posts/[id]/comments">;

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
