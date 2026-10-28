import type { Me } from "@/lib/types";
import { requireUser } from "@/lib/server/auth";
import { ApiError, json, readBody, route } from "@/lib/server/http";
import { authUser, publicUser, stats } from "@/lib/server/views";
import { BIO_MAX } from "@/lib/validation";

export const GET = route((request) => {
  const user = requireUser(request);
  const me: Me = { ...publicUser(user), email: user.email };
  return json({ user: me, stats: stats(user.id) });
});

export const PATCH = route(async (request) => {
  const user = requireUser(request);
  const body = await readBody(request, { bio: "string?" });
  if (body.bio !== undefined) {
    if (body.bio.length > BIO_MAX) throw new ApiError("INVALID_INPUT", `Bio : ${BIO_MAX} caractères maximum.`);
    user.bio = body.bio.trim();
  }
  return json({ user: { ...authUser(user), bio: user.bio } });
});
