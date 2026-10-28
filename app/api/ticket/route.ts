import { requireUser } from "@/lib/server/auth";
import { ApiError, json, route } from "@/lib/server/http";
import { currentTicket, ticketView } from "@/lib/server/shop";

export const GET = route(async (request) => {
  const user = await requireUser(request);
  const ticket = await currentTicket(user.id);
  if (!ticket) throw new ApiError("NOT_FOUND", "Aucun ticket en cours.");
  return json({ ticket: ticketView(ticket) });
});
