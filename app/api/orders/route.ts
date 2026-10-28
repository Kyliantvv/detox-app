import { requireUser } from "@/lib/server/auth";
import { json, readBody, route } from "@/lib/server/http";
import { withPoints } from "@/lib/server/points";
import { buy, listOrders, orderView } from "@/lib/server/shop";

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
