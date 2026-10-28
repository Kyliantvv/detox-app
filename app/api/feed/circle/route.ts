import { db } from "@/lib/db";
import { requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { visibleWhere } from "@/lib/server/posts";
import { postViews } from "@/lib/server/views";

const LIMIT = 50;

// Mon cercle : posts des comptes suivis et les miens, du plus récent au plus ancien.
export const GET = route(async (request) => {
  const user = await requireUser(request);
  const follows = await db.follow.findMany({ where: { followerId: user.id }, select: { followingId: true } });
  const authors = [user.id, ...follows.map((follow) => follow.followingId)];
  const posts = await db.post.findMany({
    where: { AND: [{ type: "photo", authorId: { in: authors } }, await visibleWhere(user.id)] },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
  });
  return json({ items: await postViews(posts, user.id) });
});
