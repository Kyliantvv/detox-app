import { requireUser } from "@/lib/server/auth";
import { ApiError, json, route } from "@/lib/server/http";
import { currentTicket, ticketView } from "@/lib/server/shop";

/**
 * @openapi
 * /api/ticket:
 *   get:
 *     tags:
 *       - Tirages
 *     summary: Ticket en cours
 *     responses:
 *       '200':
 *         description: Le ticket, cases non grattées masquées
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ticket:
 *                   $ref: '#/components/schemas/TicketView'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 */
export const GET = route(async (request) => {
  const user = await requireUser(request);
  const ticket = await currentTicket(user.id);
  if (!ticket) throw new ApiError("NOT_FOUND", "Aucun ticket en cours.");
  return json({ ticket: ticketView(ticket) });
});
