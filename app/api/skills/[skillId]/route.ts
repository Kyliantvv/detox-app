import { requireUser } from "@/lib/server/auth";
import { json, readBody, route } from "@/lib/server/http";
import { withPoints } from "@/lib/server/points";
import { buyTargetSkill, ownedSkills, unlockedIntel } from "@/lib/server/shop";

// Achat unique par cible ; la cible n'est jamais notifiée.
export const POST = route(async (request, ctx: RouteContext<"/api/skills/[skillId]">) => {
  const user = await requireUser(request);
  const { skillId } = await ctx.params;
  const { targetId } = await readBody(request, { targetId: "string" });
  const events = await buyTargetSkill(user.id, targetId, skillId);
  const owned = await ownedSkills(user.id, targetId);
  const { points } = await withPoints(user.id, []);
  return json({ owned, intel: await unlockedIntel(owned, targetId), points, events });
});
