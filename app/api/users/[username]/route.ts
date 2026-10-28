import { db } from "@/lib/db";
import { requireUser } from "@/lib/server/auth";
import { ApiError, assertId, json, route } from "@/lib/server/http";
import { recordProfileView } from "@/lib/server/shop";
import { publicUser } from "@/lib/server/views";

/**
 * @openapi
 * /api/users/{username}:
 *   get:
 *     tags: [Comptes]
 *     summary: Profil public d'un compte
 *     description: Compte une visite de profil, ce qui alimente la compétence « Visites de profil ».
 *     parameters:
 *       - { name: username, in: path, required: true, schema: { type: string } }
 *     responses:
 *       '200': { description: Le profil, content: { application/json: { schema: { type: object, properties: { user: { $ref: '#/components/schemas/PublicUser' } } } } } }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 */
export const GET = route(async (request, ctx: RouteContext<"/api/users/[username]">) => {
  const user = await requireUser(request);
  const { username } = await ctx.params;
  const target = await db.user.findUnique({ where: { username: assertId(username, "username").toLowerCase() } });
  if (!target) throw new ApiError("NOT_FOUND", "Compte introuvable.");
  // Nourrit la compétence « Visites de profil » de la Clairvoyance.
  await recordProfileView(user.id, target.id);
  return json({ user: await publicUser(target, user.id) });
});
