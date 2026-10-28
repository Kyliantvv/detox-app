import { SKILLS } from "@/lib/server/seed";
import type { SkillView } from "@/lib/types";
import { requireUser } from "@/lib/server/auth";
import { ApiError, assertId, json, route } from "@/lib/server/http";
import { assertTarget, ownedSkills, unlockedIntel } from "@/lib/server/shop";

// Catalogue de la Clairvoyance pour une cible, avec ce qui est déjà débloqué.
export const GET = route((request) => {
  const user = requireUser(request);
  const targetId = request.nextUrl.searchParams.get("targetId");
  if (!targetId) throw new ApiError("INVALID_INPUT", "Paramètre targetId requis.");
  assertTarget(user.id, assertId(targetId, "targetId"));
  const owned = ownedSkills(user.id, targetId);
  return json({
    items: SKILLS.map((skill): SkillView => ({ ...skill, owned: owned.includes(skill.id) })),
    intel: unlockedIntel(user.id, targetId),
  });
});
