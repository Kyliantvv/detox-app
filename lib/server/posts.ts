// Visibilité des posts et aide commune aux routes /api/posts/[id]/… .
import type { NextRequest } from "next/server";
import { db, Prisma, toId } from "../db";
import { requireUser } from "./auth";
import { ApiError } from "./http";

// Un post `closeFriends` n'est visible que de son auteur et de son cercle proche.
export async function visibleWhere(viewerId: string): Promise<Prisma.PostWhereInput> {
  const owners = await db.closeFriend.findMany({ where: { friendId: viewerId }, select: { ownerId: true } });
  return {
    OR: [
      { visibility: "public" },
      { authorId: { in: [viewerId, ...owners.map((owner) => owner.ownerId)] } },
    ],
  };
}

// Résout l'utilisateur et le post visé ; un post invisible répond 404, comme un absent.
export async function userAndPost(request: NextRequest, params: Promise<{ id: string }>) {
  const user = await requireUser(request);
  const { id } = await params;
  const post = await db.post.findFirst({ where: { AND: [{ id: toId(id, "Post") }, await visibleWhere(user.id)] } });
  if (!post) throw new ApiError("NOT_FOUND", "Post introuvable.");
  return { user, post };
}
