import { requireUser } from "@/lib/server/auth";
import { json, readBody, route } from "@/lib/server/http";
import { withPoints } from "@/lib/server/points";
import { scratch } from "@/lib/server/shop";

export const POST = route(async (request) => {
  const user = await requireUser(request);
  const { index } = await readBody(request, { index: "number" });
  const { ticket, gains } = await scratch(user.id, index);
  return json({ ticket, ...(await withPoints(user.id, gains)) });
});
