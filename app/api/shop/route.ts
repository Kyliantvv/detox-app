import { route, json } from "@/lib/server/http";
import { listShopItems, shopItemView } from "@/lib/server/shop";

export const GET = route(async () => json({ items: (await listShopItems()).map(shopItemView) }));
