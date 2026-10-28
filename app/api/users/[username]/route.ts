import { requireUser } from "@/lib/server/auth";
import { userByUsername } from "@/lib/server/db";
import { ApiError, assertId, json, route } from "@/lib/server/http";
import { recordProfileView } from "@/lib/server/shop";
import { publicUser } from "@/lib/server/views";

export const GET = route(async (request, ctx: RouteContext<"/api/users/[username]">) => {
  const user = requireUser(request);
  const { username } = await ctx.params;
  const target = userByUsername(assertId(username, "username"));
  if (!target) throw new ApiError("NOT_FOUND", "Compte introuvable.");
  // Nourrit la compétence « Visites de profil » de la Clairvoyance.
  recordProfileView(user.id, target.id);
  return json({ user: publicUser(target, user.id) });
});
