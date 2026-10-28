import { requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { reelRecommendations } from "@/lib/server/recommend";
import { postViews } from "@/lib/server/views";

// Reels triés par l'algorithme de recommandation, chacun avec sa raison.
export const GET = route(async (request) => {
  const user = await requireUser(request);
  const picks = await reelRecommendations(user.id);
  const views = await postViews(picks.map((pick) => pick.post), user.id);
  return json({ items: views.map((view, i) => ({ ...view, reason: picks[i].reason })) });
});
