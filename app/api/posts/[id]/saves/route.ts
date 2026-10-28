import { db } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";
import { userAndPost } from "@/lib/server/post-route";

type Ctx = RouteContext<"/api/posts/[id]/saves">;

export const POST = route(async (request, ctx: Ctx) => {
  const { user, post } = await userAndPost(request, ctx.params);
  db().saves.add(`${user.id}:${post.id}`);
  return json({ savedByMe: true });
});

export const DELETE = route(async (request, ctx: Ctx) => {
  const { user, post } = await userAndPost(request, ctx.params);
  db().saves.delete(`${user.id}:${post.id}`);
  return json({ savedByMe: false });
});
