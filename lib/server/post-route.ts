// Aide commune aux routes /api/posts/[id]/… : résout l'utilisateur et le post visé.
import type { NextRequest } from "next/server";
import { requireUser } from "./auth";
import { findPost } from "./db";
import { ApiError, assertId } from "./http";

export async function userAndPost(request: NextRequest, params: Promise<{ id: string }>) {
  const user = requireUser(request);
  const { id } = await params;
  const post = findPost(assertId(id));
  if (!post) throw new ApiError("NOT_FOUND", "Post introuvable.");
  return { user, post };
}
