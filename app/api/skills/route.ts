import { SKILLS } from "@/lib/db";
import type { SkillView } from "@/lib/types";
import { requireUser } from "@/lib/server/auth";
import { SKILL_CATALOG } from "@/lib/server/content";
import { ApiError, json, route } from "@/lib/server/http";
import { assertTarget, ownedSkills, unlockedIntel } from "@/lib/server/shop";

// Catalogue de la Clairvoyance pour une cible, avec ce qui est déjà débloqué.
export const GET = route(async (request) => {
  const user = await requireUser(request);
  const targetId = request.nextUrl.searchParams.get("targetId");
  if (!targetId) throw new ApiError("INVALID_INPUT", "Paramètre targetId requis.");
  const target = await assertTarget(user.id, targetId);
  const owned = await ownedSkills(user.id, target.id);
  return json({
    items: SKILL_CATALOG.map(({ id, name, shows, skill }): SkillView => ({
      id,
      name,
      shows,
      price: SKILLS[skill],
      owned: owned.includes(id),
    })),
    intel: await unlockedIntel(owned, target.id),
  });
});
