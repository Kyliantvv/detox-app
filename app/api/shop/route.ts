import { route, json } from "@/lib/server/http";
import { listShopItems, shopItemView } from "@/lib/server/shop";

/**
 * @openapi
 * /api/shop:
 *   get:
 *     tags:
 *       - L'Épicerie
 *     summary: Catalogue de L'Épicerie
 *     security: []
 *     responses:
 *       '200':
 *         description: Les 4 articles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ShopItem'
 */
export const GET = route(async () => json({ items: (await listShopItems()).map(shopItemView) }));
