import { requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { withPoints } from "@/lib/server/points";
import { buy } from "@/lib/server/shop";

// Achète un ticket à gratter : le tirage est fait ici, jamais par le client.
export const POST = route((request) => {
  const user = requireUser(request);
  const { purchase, gains } = buy(user.id, "ticket");
  return json({ ...purchase, ...withPoints(user.id, gains) }, 201);
});
