import { CHEST_EVERY_PAGES, POINTS } from "@/lib/game";
import { flowPage } from "@/lib/server/seed";
import type { PointEvent } from "@/lib/types";
import { requireUser } from "@/lib/server/auth";
import { accountOf, findPost } from "@/lib/server/db";
import { ApiError, json, route } from "@/lib/server/http";
import { credit, withPoints } from "@/lib/server/points";
import { postView } from "@/lib/server/views";

const MAX_PAGE = 10_000;

// Flow infini : chaque page est créditée une seule fois, avec coffre et bonus aléatoire.
export const GET = route((request) => {
  const user = requireUser(request);
  const raw = request.nextUrl.searchParams.get("page") ?? "0";
  const page = Number(raw);
  if (!/^\d+$/.test(raw) || page > MAX_PAGE) throw new ApiError("INVALID_INPUT", "page doit être un entier positif.");

  const account = accountOf(user.id);
  const gains: PointEvent[] = [];
  if (!account.flowPagesRead.includes(page)) {
    account.flowPagesRead.push(page);
    account.serenity = Math.max(0, account.serenity - 3);
    gains.push(credit(user.id, POINTS.flowPage, `Page ${page + 1} du Flow`, { combo: true }));
    if (account.flowPagesRead.length % CHEST_EVERY_PAGES === 0) gains.push(credit(user.id, POINTS.chest, "Coffre ouvert"));
    if (Math.random() < 0.15) gains.push(credit(user.id, 10 + Math.floor(Math.random() * 15) * 10, "Bonus aléatoire"));
  }
  const items = flowPage(page).map((post) => postView(findPost(post.id)!, user.id));
  return json({ items, page, nextPage: page < MAX_PAGE ? page + 1 : null, serenity: account.serenity, ...withPoints(user.id, gains) });
});
