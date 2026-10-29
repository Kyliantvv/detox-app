import { CHEST_EVERY, likesToday, flowPagesToday, isDuplicateKey, recordPostsSeen, serenityFor } from "@/lib/db";
import { FLOW_PER_PAGE, POINTS } from "@/lib/game";
import type { PointEvent } from "@/lib/types";
import { requireUser } from "@/lib/server/auth";
import { ApiError, json, route } from "@/lib/server/http";
import { credit, withPoints } from "@/lib/server/points";
import { flowRecommendations } from "@/lib/server/recommend";
import { postViews } from "@/lib/server/views";

const MAX_PAGE = 10_000;

/**
 * @openapi
 * /api/feed/flow:
 *   get:
 *     tags: [Fil]
 *     summary: Page du Flow
 *     description: Infini. Les posts sont choisis par l'algorithme de recommandation (goûts de l'utilisateur, popularité, une surprise) et chacun porte sa `reason`. Chaque page crédite des points une seule fois ; la relire renvoie les mêmes posts.
 *     parameters:
 *       - { name: page, in: query, required: false, schema: { type: integer, minimum: 0, maximum: 10000, default: 0 } }
 *     responses:
 *       '200': { description: Page du Flow, content: { application/json: { schema: { allOf: [{ type: object, properties: { items: { type: array, items: { $ref: '#/components/schemas/PostView' } }, page: { type: integer }, nextPage: { type: [integer, 'null'] }, serenity: { type: integer } } }, { $ref: '#/components/schemas/PointsResponse' }] } } } }
 *       '400': { $ref: '#/components/responses/InvalidInput' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 */
// Flow infini : chaque page est créditée une seule fois (index unique), avec coffre et bonus aléatoire.
export const GET = route(async (request) => {
  const user = await requireUser(request);
  const raw = request.nextUrl.searchParams.get("page") ?? "0";
  const page = Number(raw);
  if (!/^\d+$/.test(raw) || page > MAX_PAGE) throw new ApiError("INVALID_INPUT", "page doit être un entier positif.");

  const gains: PointEvent[] = [];
  let firstRead = true;
  try {
    gains.push(...(await credit(user.id, POINTS.flowPage, "flow_page", `Page ${page + 1} du Flow`, { combo: true, flowPage: page })));
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    firstRead = false;
  }
  if (firstRead) {
    const seen = await recordPostsSeen(user.id, FLOW_PER_PAGE);
    if (seen.total % CHEST_EVERY === 0) gains.push(...(await credit(user.id, POINTS.chest, "chest", "Coffre ouvert")));
    if (Math.random() < 0.15) {
      gains.push(...(await credit(user.id, 10 + Math.floor(Math.random() * 15) * 10, "bonus", "Bonus aléatoire")));
    }
  }
  // Posts choisis par l'algorithme de recommandation (lib/server/recommend.ts), avec leur raison.
  const picks = await flowRecommendations(user.id, page);
  const views = await postViews(picks.map((pick) => pick.post), user.id);
  const items = views.map((view, i) => ({ ...view, reason: picks[i].reason }));
  const serenity = serenityFor(await flowPagesToday(user.id), await likesToday(user.id));
  return json({
    items,
    page,
    nextPage: page < MAX_PAGE ? page + 1 : null,
    serenity,
    ...(await withPoints(user.id, gains)),
  });
});
