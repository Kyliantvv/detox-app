import { requireUser } from "@/lib/server/auth";
import { db, followingOf } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";
import { postView } from "@/lib/server/views";

// Mon cercle : posts des comptes suivis et les miens, du plus récent au plus ancien.
export const GET = route((request) => {
  const user = requireUser(request);
  const authors = new Set([...followingOf(user.id), user.id]);
  const items = [...db().posts.values()]
    .filter((post) => !post.isReel && authors.has(post.authorId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((post) => postView(post, user.id));
  return json({ items });
});
