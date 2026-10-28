import { requireUser } from "@/lib/server/auth";
import { db, followingOf } from "@/lib/server/db";
import { ApiError, assertId, json, readBody, route } from "@/lib/server/http";

export const GET = route((request) => {
  const user = requireUser(request);
  return json({ items: [...followingOf(user.id)] });
});

export const POST = route(async (request) => {
  const user = requireUser(request);
  const { targetId } = await readBody(request, { targetId: "string" });
  if (!db().users.has(assertId(targetId, "targetId")) || targetId === user.id) {
    throw new ApiError("NOT_FOUND", "Compte introuvable.");
  }
  followingOf(user.id).add(targetId);
  return json({ items: [...followingOf(user.id)] }, 201);
});
