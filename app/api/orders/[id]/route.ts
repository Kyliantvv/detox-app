import { requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { findOrder, trackingSteps } from "@/lib/server/shop";

/**
 * @openapi
 * /api/orders/{id}:
 *   get:
 *     tags:
 *       - L'Épicerie
 *     summary: Détail d'une commande et son suivi
 *     description: Les étapes se valident avec le temps écoulé depuis l'achat . La commande d'un autre compte répond 404.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: La commande
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 order:
 *                   $ref: '#/components/schemas/OrderDetail'
 *       '400':
 *         $ref: '#/components/responses/InvalidInput'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 */
// Détail d'une commande et son suivi. Celle d'un autre compte répond 404.
export const GET = route(async (request, ctx: RouteContext<"/api/orders/[id]">) => {
  const user = await requireUser(request);
  const { id } = await ctx.params;
  const order = await findOrder(user.id, id);
  return json({ order: { ...order, steps: trackingSteps(order) } });
});
