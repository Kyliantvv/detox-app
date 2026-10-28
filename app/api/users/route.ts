import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";
import { publicUser } from "@/lib/server/views";

// Recherche de comptes par nom d'utilisateur ou prénom.
export const GET = route((request) => {
  const user = requireUser(request);
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const items = [...db().users.values()]
    .filter((other) => other.id !== user.id)
    .filter((other) => !q || other.username.toLowerCase().includes(q) || other.name.toLowerCase().includes(q))
    .slice(0, 50)
    .map((other) => publicUser(other, user.id));
  return json({ items });
});
