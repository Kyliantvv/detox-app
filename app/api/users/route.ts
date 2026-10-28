import { db } from "@/lib/db";
import { requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { followingIds, publicUser } from "@/lib/server/views";

const LIMIT = 50;

// Recherche de comptes par nom d'utilisateur ou prénom. Sans `q` (cibles de la Clairvoyance),
// les comptes suivis d'abord.
export const GET = route(async (request) => {
  const user = await requireUser(request);
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const others = { id: { not: user.id } };
  let users;
  if (q) {
    const contains = { contains: q, mode: "insensitive" as const };
    users = await db.user.findMany({
      where: { AND: [others, { OR: [{ username: contains }, { displayName: contains }] }] },
      orderBy: { username: "asc" },
      take: LIMIT,
    });
  } else {
    const followed = await followingIds(user.id);
    const first = await db.user.findMany({ where: { id: { in: followed } }, orderBy: { username: "asc" }, take: LIMIT });
    const rest = await db.user.findMany({
      where: { id: { notIn: [user.id, ...followed] } },
      orderBy: { username: "asc" },
      take: LIMIT - first.length,
    });
    users = [...first, ...rest];
  }
  return json({ items: await Promise.all(users.map((other) => publicUser(other, user.id))) });
});
