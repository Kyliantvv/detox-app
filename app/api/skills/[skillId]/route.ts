import { SKILLS } from "@/lib/server/seed";
import type { PointEvent } from "@/lib/types";
import { requireUser } from "@/lib/server/auth";
import { accountOf, db } from "@/lib/server/db";
import { ApiError, assertId, json, readBody, route } from "@/lib/server/http";
import { debit } from "@/lib/server/points";
import { assertTarget, ownedSkills, unlockedIntel } from "@/lib/server/shop";

// Achat unique par cible ; la cible n'est jamais notifiée.
export const POST = route(async (request, ctx: RouteContext<"/api/skills/[skillId]">) => {
  const user = requireUser(request);
  const { skillId } = await ctx.params;
  const skill = SKILLS.find((s) => s.id === assertId(skillId, "skillId"));
  if (!skill) throw new ApiError("NOT_FOUND", "Compétence introuvable.");
  const { targetId } = await readBody(request, { targetId: "string" });
  assertTarget(user.id, assertId(targetId, "targetId"));

  const owned = ownedSkills(user.id, targetId);
  const events: PointEvent[] = [];
  if (!owned.includes(skill.id)) {
    events.push(debit(user.id, skill.price, `Clairvoyance : ${skill.name}`));
    const unlocked = skill.id === "dossier-complet" ? SKILLS.map((s) => s.id) : [...owned, skill.id];
    const skills = db().skills;
    skills.set(user.id, { ...skills.get(user.id), [targetId]: unlocked });
  }
  return json({
    owned: ownedSkills(user.id, targetId),
    intel: unlockedIntel(user.id, targetId),
    points: accountOf(user.id).points,
    events,
  });
});
