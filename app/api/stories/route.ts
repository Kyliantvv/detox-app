import type { StoryItem } from "@/lib/types";
import { requireUser } from "@/lib/server/auth";
import { activeInstant, db, followingOf, formatAgo } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";
import { author } from "@/lib/server/views";

// Comptes suivis, avec leur Instant s'il a moins de 24 h (ceux qui en ont un d'abord).
export const GET = route((request) => {
  const user = requireUser(request);
  const users = db().users;
  const items: StoryItem[] = [...followingOf(user.id)]
    .map((id) => users.get(id))
    .filter((other) => other !== undefined)
    .map((other) => {
      const instant = activeInstant(other.id);
      return {
        ...author(other),
        instant: instant ? { art: instant.art, text: instant.text, ago: formatAgo(instant.at) } : null,
      };
    })
    .sort((a, b) => Number(Boolean(b.instant)) - Number(Boolean(a.instant)));
  return json({ items });
});
