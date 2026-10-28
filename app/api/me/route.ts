import { db } from "@/lib/db";
import type { Me } from "@/lib/types";
import { requireUser } from "@/lib/server/auth";
import { ApiError, json, readBody, route } from "@/lib/server/http";
import { authUser, publicUser, stats } from "@/lib/server/views";
import { BIO_MAX } from "@/lib/validation";

export const GET = route(async (request) => {
  const user = await requireUser(request);
  const me: Me = { ...(await publicUser(user)), email: user.email };
  return json({ user: me, stats: await stats(user) });
});

export const PATCH = route(async (request) => {
  const user = await requireUser(request);
  const body = await readBody(request, { bio: "string?" });
  let bio = user.bio;
  if (body.bio !== undefined) {
    if (body.bio.length > BIO_MAX) throw new ApiError("INVALID_INPUT", `Bio : ${BIO_MAX} caractères maximum.`);
    ({ bio } = await db.user.update({ where: { id: user.id }, data: { bio: body.bio.trim() }, select: { bio: true } }));
  }
  return json({ user: { ...authUser(user), bio } });
});
