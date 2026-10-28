import { db } from "@/lib/db";
import type { ArtVariant, StoryItem } from "@/lib/types";
import { requireUser } from "@/lib/server/auth";
import { formatAgo } from "@/lib/server/format";
import { json, route } from "@/lib/server/http";
import { author } from "@/lib/server/views";

// Comptes suivis, avec leur Instant s'il a moins de 24 h (ceux qui en ont un d'abord).
export const GET = route(async (request) => {
  const user = await requireUser(request);
  const follows = await db.follow.findMany({
    where: { followerId: user.id },
    orderBy: { createdAt: "asc" },
    select: { following: { select: { id: true, username: true, displayName: true } } },
  });
  const ids = follows.map((follow) => follow.following.id);
  // L'index TTL supprime les Instants avec un peu de retard : on filtre aussi sur expiresAt.
  const stories = await db.story.findMany({
    where: { authorId: { in: ids }, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  const latest = new Map<string, (typeof stories)[number]>();
  for (const story of stories) if (!latest.has(story.authorId)) latest.set(story.authorId, story);
  const items: StoryItem[] = follows
    .map(({ following }) => {
      const story = latest.get(following.id);
      return {
        ...author(following),
        instant: story ? { art: story.art as ArtVariant, text: story.text, ago: formatAgo(story.createdAt) } : null,
      };
    })
    .sort((a, b) => Number(Boolean(b.instant)) - Number(Boolean(a.instant)));
  return json({ items });
});
