import { requireUser } from "@/lib/server/auth";
import { json, readBody, route } from "@/lib/server/http";
import { withPoints } from "@/lib/server/points";
import { buyTargetSkill, ownedSkills, unlockedIntel } from "@/lib/server/shop";

/**
 * @openapi
 * /api/skills/{skillId}:
 *   post:
 *     tags:
 *       - Clairvoyance
 *     summary: Acheter une compétence sur une cible
 *     description: 'Achat unique par cible : une compétence déjà possédée n''est pas débitée une seconde fois. « dossier-complet » débloque tout.'
 *     parameters:
 *       - name: skillId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum:
 *              - derniere-connexion
 *              - solde
 *              - serie
 *              - temps-scroll
 *              - derniers-achats
 *              - visites-profil
 *              - plus-gros-gain
 *              - heures-pointe
 *              - cercle-proche
 *              - dossier-complet
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetId
 *             additionalProperties: false
 *             properties:
 *               targetId:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Compétences possédées et informations révélées
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 owned:
 *                   type: array
 *                   items:
 *                     type: string
 *                     enum:
 *                       - derniere-connexion
 *                       - solde
 *                       - serie
 *                       - temps-scroll
 *                       - derniers-achats
 *                       - visites-profil
 *                       - plus-gros-gain
 *                       - heures-pointe
 *                       - cercle-proche
 *                       - dossier-complet
 *                 intel:
 *                   $ref: '#/components/schemas/Intel'
 *                 points:
 *                   type: integer
 *                 events:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PointEvent'
 *       '400':
 *         $ref: '#/components/responses/InvalidInput'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         $ref: '#/components/responses/InsufficientPoints'
 */
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
