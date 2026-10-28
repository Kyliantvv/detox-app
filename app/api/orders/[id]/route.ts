import { requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { findOrder, trackingSteps } from "@/lib/server/shop";

// Détail d'une commande et son faux suivi. Celle d'un autre compte répond 404.
export const GET = route(async (request, ctx: RouteContext<"/api/orders/[id]">) => {
  const user = await requireUser(request);
  const { id } = await ctx.params;
  const order = await findOrder(user.id, id);
  return json({ order: { ...order, steps: trackingSteps(order) } });
});
