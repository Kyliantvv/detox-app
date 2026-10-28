import { requireUser } from "@/lib/server/auth";
import { json, readBody, route } from "@/lib/server/http";
import { withPoints } from "@/lib/server/points";
import { scratch } from "@/lib/server/shop";

export const POST = route(async (request) => {
  const user = requireUser(request);
  const { index } = await readBody(request, { index: "number" });
  const { ticket, gains } = scratch(user.id, index);
  return json({ ticket, ...withPoints(user.id, gains) });
});
