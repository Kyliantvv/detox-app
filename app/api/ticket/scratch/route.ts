import { requireUser } from "@/lib/server/auth";
import { json, readBody, route } from "@/lib/server/http";
import { withPoints } from "@/lib/server/points";
import { scratch } from "@/lib/server/shop";

/**
 * @openapi
 * /api/ticket/scratch:
 *   post:
 *     tags:
 *       - Tirages
 *     summary: Gratter une case
 *     description: Le gain est versé une seule fois, quand la dernière case est grattée.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - index
 *             additionalProperties: false
 *             properties:
 *               index:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 5
 *     responses:
 *       '200':
 *         description: Ticket mis à jour
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties:
 *                     ticket:
 *                       $ref: '#/components/schemas/TicketView'
 *                 - $ref: '#/components/schemas/PointsResponse'
 *       '400':
 *         $ref: '#/components/responses/InvalidInput'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 */
export const POST = route(async (request) => {
  const user = await requireUser(request);
  const { index } = await readBody(request, { index: "number" });
  const { ticket, gains } = await scratch(user.id, index);
  return json({ ticket, ...(await withPoints(user.id, gains)) });
});
