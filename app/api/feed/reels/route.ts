import { requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { reelRecommendations } from "@/lib/server/recommend";
import { postView } from "@/lib/server/views";

// Reels triés par l'algorithme de recommandation, chacun avec sa raison.
export const GET = route((request) => {
  const user = requireUser(request);
  const items = reelRecommendations(user.id).map(({ post, reason }) => ({ ...postView(post, user.id), reason }));
  return json({ items });
});
