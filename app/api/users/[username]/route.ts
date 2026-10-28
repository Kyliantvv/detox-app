import { requireUser } from "@/lib/server/auth";
import { userByUsername } from "@/lib/server/db";
import { ApiError, assertId, json, route } from "@/lib/server/http";
import { publicUser } from "@/lib/server/views";

export const GET = route(async (request, ctx: RouteContext<"/api/users/[username]">) => {
  const user = requireUser(request);
  const { username } = await ctx.params;
  const target = userByUsername(assertId(username, "username"));
  if (!target) throw new ApiError("NOT_FOUND", "Compte introuvable.");
  return json({ user: publicUser(target, user.id) });
});
