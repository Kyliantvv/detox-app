import { db, isDuplicateKey, toId } from "@/lib/db";
import { requireUser } from "@/lib/server/auth";
import { ApiError, json, readBody, route } from "@/lib/server/http";
import { followingIds } from "@/lib/server/views";

/**
 * @openapi
 * /api/follows:
 *   get:
 *     tags: [Abonnements]
 *     summary: Ids des comptes que je suis
 *     responses:
 *       '200': { description: Ids suivis, content: { application/json: { schema: { type: object, properties: { items: { type: array, items: { type: string } } } } } } }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     tags: [Abonnements]
 *     summary: Suivre un compte
 *     description: Idempotent.
 *     requestBody: { required: true, content: { application/json: { schema: { type: object, additionalProperties: false, required: [targetId], properties: { targetId: { type: string } } } } } }
 *     responses:
 *       '201': { description: Ids suivis après l'abonnement, content: { application/json: { schema: { type: object, properties: { items: { type: array, items: { type: string } } } } } } }
 *       '400': { $ref: '#/components/responses/InvalidInput' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 */
export const GET = route(async (request) => {
  const user = await requireUser(request);
  return json({ items: await followingIds(user.id) });
});

export const POST = route(async (request) => {
  const user = await requireUser(request);
  const { targetId } = await readBody(request, { targetId: "string" });
  const target = await db.user.findUnique({ where: { id: toId(targetId, "targetId") }, select: { id: true } });
  if (!target || target.id === user.id) throw new ApiError("NOT_FOUND", "Compte introuvable.");
  try {
    await db.follow.create({ data: { followerId: user.id, followingId: target.id } });
  } catch (error) {
    // Déjà suivi : idempotent.
    if (!isDuplicateKey(error)) throw error;
  }
  return json({ items: await followingIds(user.id) }, 201);
});
