import { db } from "@/lib/db";
import type { Me } from "@/lib/types";
import { requireUser } from "@/lib/server/auth";
import { ApiError, json, readBody, route } from "@/lib/server/http";
import { authUser, publicUser, stats } from "@/lib/server/views";
import { BIO_MAX } from "@/lib/validation";

/**
 * @openapi
 * /api/me:
 *   get:
 *     tags: [Compte]
 *     summary: Mon profil et mes statistiques
 *     description: Source du solde, de la série et des stats.
 *     responses:
 *       '200': { description: Le compte connecté, content: { application/json: { schema: { type: object, properties: { user: { $ref: '#/components/schemas/Me' }, stats: { $ref: '#/components/schemas/Stats' } } } } } }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *   patch:
 *     tags: [Compte]
 *     summary: Modifier ma bio
 *     requestBody: { required: true, content: { application/json: { schema: { type: object, additionalProperties: false, required: [], properties: { bio: { type: string, maxLength: 160 } } } } } }
 *     responses:
 *       '200': { description: Compte mis à jour, content: { application/json: { schema: { type: object, properties: { user: { $ref: '#/components/schemas/AuthUser' } } } } } }
 *       '400': { $ref: '#/components/responses/InvalidInput' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 */
export const GET = route(async (request) => {
  const user = await requireUser(request);
  const me: Me = { ...(await publicUser(user)), email: user.email };
  return json({ user: me, stats: await stats(user) });
});

export const PATCH = route(async (request) => {
  const user = await requireUser(request);
  const body = await readBody(request, { bio: "string?" });
  let bio = user.bio;
  if (body.bio !== undefined) {
    if (body.bio.length > BIO_MAX) throw new ApiError("INVALID_INPUT", `Bio : ${BIO_MAX} caractères maximum.`);
    ({ bio } = await db.user.update({ where: { id: user.id }, data: { bio: body.bio.trim() }, select: { bio: true } }));
  }
  return json({ user: { ...authUser(user), bio } });
});
