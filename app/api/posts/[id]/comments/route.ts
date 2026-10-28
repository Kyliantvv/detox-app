import { POINTS } from "@/lib/game";
import { db } from "@/lib/server/db";
import { ApiError, json, readBody, route } from "@/lib/server/http";
import { credit, withPoints } from "@/lib/server/points";
import { userAndPost } from "@/lib/server/post-route";
import { COMMENT_MAX } from "@/lib/validation";

type Ctx = RouteContext<"/api/posts/[id]/comments">;

export const GET = route(async (request, ctx: Ctx) => {
  const { post } = await userAndPost(request, ctx.params);
  const items = (db().comments.get(post.id) ?? []).map(({ author, text }) => ({ author, text }));
  return json({ items });
});

export const POST = route(async (request, ctx: Ctx) => {
  const { user, post } = await userAndPost(request, ctx.params);
  const { text } = await readBody(request, { text: "string" });
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > COMMENT_MAX) {
    throw new ApiError("INVALID_INPUT", `Commentaire : 1 à ${COMMENT_MAX} caractères.`);
  }
  const comments = db().comments;
  const comment = { author: user.username, text: trimmed, at: Date.now() };
  comments.set(post.id, [...(comments.get(post.id) ?? []), comment]);
  const gains = [credit(user.id, POINTS.reaction, "Réaction", { combo: true })];
  return json({ comment: { author: comment.author, text: comment.text }, ...withPoints(user.id, gains) }, 201);
});
