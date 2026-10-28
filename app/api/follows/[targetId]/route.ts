import { requireUser } from "@/lib/server/auth";
import { followingOf } from "@/lib/server/db";
import { assertId, json, route } from "@/lib/server/http";

export const DELETE = route(async (request, ctx: RouteContext<"/api/follows/[targetId]">) => {
  const user = requireUser(request);
  const { targetId } = await ctx.params;
  followingOf(user.id).delete(assertId(targetId, "targetId"));
  return json({ items: [...followingOf(user.id)] });
});
