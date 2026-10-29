import { requireUser } from "@/lib/server/auth";
import { json, readBody, route } from "@/lib/server/http";
import { withPoints } from "@/lib/server/points";
import { buy, listOrders, orderView } from "@/lib/server/shop";

/**
 * @openapi
 * /api/orders:
 *   get:
 *     tags:
 *       - L'Épicerie
 *     summary: Mes commandes, de la plus récente à la plus ancienne
 *     responses:
 *       '200':
 *         description: Commandes du compte connecté
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *   post:
 *     tags:
 *       - L'Épicerie
 *     summary: Acheter un article
 *     description: Débite le prix, puis crée une commande, un ticket à gratter ou ouvre une loot box selon l'article.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - itemId
 *             additionalProperties: false
 *             properties:
 *               itemId:
 *                 type: string
 *                 enum:
 *                   - sucre
 *                   - ticket
 *                   - lootbox
 *                   - cigarettes
 *     responses:
 *       '201':
 *         description: Achat effectué
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Purchase'
 *                 - $ref: '#/components/schemas/PointsResponse'
 *       '400':
 *         $ref: '#/components/responses/InvalidInput'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         $ref: '#/components/responses/InsufficientPoints'
 */
export const GET = route(async (request) => {
  const user = await requireUser(request);
  return json({ items: (await listOrders(user.id)).map(orderView) });
});

// Achat à L'Épicerie : débit et commande, ticket ou loot box dans la même transaction.
export const POST = route(async (request) => {
  const user = await requireUser(request);
  const { itemId } = await readBody(request, { itemId: "string" });
  const { purchase, gains } = await buy(user.id, itemId);
  return json({ ...purchase, ...(await withPoints(user.id, gains)) }, 201);
});
