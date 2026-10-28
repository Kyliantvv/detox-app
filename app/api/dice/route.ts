import { requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { withPoints } from "@/lib/server/points";
import { buy } from "@/lib/server/shop";

/**
 * @openapi
 * /api/dice:
 *   post:
 *     tags:
 *       - Tirages
 *     summary: Acheter un ticket à gratter
 *     description: Remplace le ticket en cours. Les cases sont tirées ici ; les cases non grattées ne sont jamais envoyées.
 *     responses:
 *       '201':
 *         description: Ticket acheté
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Purchase'
 *                 - $ref: '#/components/schemas/PointsResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '409':
 *         $ref: '#/components/responses/InsufficientPoints'
 */
// Achète un ticket à gratter : le tirage est fait ici, jamais par le client.
export const POST = route(async (request) => {
  const user = await requireUser(request);
  const { purchase, gains } = await buy(user.id, "ticket");
  return json({ ...purchase, ...(await withPoints(user.id, gains)) }, 201);
});
