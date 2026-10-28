import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { ApiError, json, route } from "@/lib/server/http";
import { ticketView } from "@/lib/server/shop";

export const GET = route((request) => {
  const user = requireUser(request);
  const ticket = db().tickets.get(user.id);
  if (!ticket) throw new ApiError("NOT_FOUND", "Aucun ticket en cours.");
  return json({ ticket: ticketView(ticket) });
});
