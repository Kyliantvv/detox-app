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
