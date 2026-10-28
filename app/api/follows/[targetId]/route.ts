import { db, toId } from "@/lib/db";
import { requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { followingIds } from "@/lib/server/views";

export const DELETE = route(async (request, ctx: RouteContext<"/api/follows/[targetId]">) => {
  const user = await requireUser(request);
  const { targetId } = await ctx.params;
  await db.follow.deleteMany({ where: { followerId: user.id, followingId: toId(targetId, "targetId") } });
  return json({ items: await followingIds(user.id) });
});
