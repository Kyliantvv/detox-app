import { SKILLS } from "@/lib/db";
import type { SkillView } from "@/lib/types";
import { requireUser } from "@/lib/server/auth";
import { SKILL_CATALOG } from "@/lib/server/content";
import { ApiError, json, route } from "@/lib/server/http";
import { assertTarget, ownedSkills, unlockedIntel } from "@/lib/server/shop";

/**
 * @openapi
 * /api/skills:
 *   get:
 *     tags:
 *       - Clairvoyance
 *     summary: Compétences disponibles sur une cible
 *     parameters:
 *       - name: targetId
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Catalogue et informations déjà débloquées
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SkillView'
 *                 intel:
 *                   $ref: '#/components/schemas/Intel'
 *       '400':
 *         $ref: '#/components/responses/InvalidInput'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         $ref: '#/components/responses/TargetShielded'
 */
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
