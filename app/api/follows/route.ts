import { db, isDuplicateKey, toId } from "@/lib/db";
import { requireUser } from "@/lib/server/auth";
import { ApiError, json, readBody, route } from "@/lib/server/http";
import { followingIds } from "@/lib/server/views";

export const GET = route(async (request) => {
  const user = await requireUser(request);
  return json({ items: await followingIds(user.id) });
});

export const POST = route(async (request) => {
  const user = await requireUser(request);
  const { targetId } = await readBody(request, { targetId: "string" });
  const target = await db.user.findUnique({ where: { id: toId(targetId, "targetId") }, select: { id: true } });
  if (!target || target.id === user.id) throw new ApiError("NOT_FOUND", "Compte introuvable.");
  try {
    await db.follow.create({ data: { followerId: user.id, followingId: target.id } });
  } catch (error) {
    // Déjà suivi : idempotent.
    if (!isDuplicateKey(error)) throw error;
  }
  return json({ items: await followingIds(user.id) }, 201);
});
