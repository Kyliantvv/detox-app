import { db } from "@/lib/db";
import { requireUser } from "@/lib/server/auth";
import { ApiError, assertId, json, route } from "@/lib/server/http";
import { recordProfileView } from "@/lib/server/shop";
import { publicUser } from "@/lib/server/views";

export const GET = route(async (request, ctx: RouteContext<"/api/users/[username]">) => {
  const user = await requireUser(request);
  const { username } = await ctx.params;
  const target = await db.user.findUnique({ where: { username: assertId(username, "username").toLowerCase() } });
  if (!target) throw new ApiError("NOT_FOUND", "Compte introuvable.");
  // Nourrit la compétence « Visites de profil » de la Clairvoyance.
  await recordProfileView(user.id, target.id);
  return json({ user: await publicUser(target, user.id) });
});
