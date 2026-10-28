import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { json, readBody, route } from "@/lib/server/http";
import { withPoints } from "@/lib/server/points";
import { buy } from "@/lib/server/shop";

export const GET = route((request) => {
  const user = requireUser(request);
  return json({ items: db().orders.get(user.id) ?? [] });
});

// Achat à L'Épicerie : débit atomique puis commande fictive, ticket ou loot box.
export const POST = route(async (request) => {
  const user = requireUser(request);
  const { itemId } = await readBody(request, { itemId: "string" });
  const { purchase, gains } = buy(user.id, itemId);
  return json({ ...purchase, ...withPoints(user.id, gains) }, 201);
});
