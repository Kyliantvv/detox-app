import { db, isDuplicateKey } from "@/lib/db";
import { json, route } from "@/lib/server/http";
import { userAndPost } from "@/lib/server/posts";

type Ctx = RouteContext<"/api/posts/[id]/saves">;

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
