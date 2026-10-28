import { POINTS } from "@/lib/game";
import { accountOf, db } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";
import { credit, withPoints } from "@/lib/server/points";
import { userAndPost } from "@/lib/server/post-route";
import { postView } from "@/lib/server/views";

type Ctx = RouteContext<"/api/posts/[id]/likes">;

// Bonne dose : idempotente, les points ne sont crédités qu'à la première.
export const POST = route(async (request, ctx: Ctx) => {
  const { user, post } = await userAndPost(request, ctx.params);
  const key = `${user.id}:${post.id}`;
  const likes = db().likes;
  const gains = [];
  if (!likes.has(key)) {
    likes.add(key);
    const account = accountOf(user.id);
    account.serenity = Math.max(0, account.serenity - 1);
    gains.push(credit(user.id, POINTS.dose, "Bonne dose donnée", { combo: true }));
  }
  const { doses, dosedByMe } = postView(post, user.id);
  return json({ doses, dosedByMe, ...withPoints(user.id, gains) });
});

export const DELETE = route(async (request, ctx: Ctx) => {
  const { user, post } = await userAndPost(request, ctx.params);
  db().likes.delete(`${user.id}:${post.id}`);
  const { doses, dosedByMe } = postView(post, user.id);
  return json({ doses, dosedByMe });
});
