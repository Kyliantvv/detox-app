import type { Tx } from "./client";
import { isDuplicateKey, NotFoundError } from "./errors";
import { type Id, inTransaction, toId } from "./ids";

// Le Like, le Repost ou le Comment et le compteur du Post s'écrivent dans la
// même transaction. Les compteurs ne bougent que si le document a vraiment été
// créé ou supprimé : un double clic ne compte qu'une fois et le compteur ne
// descend jamais sous 0.

type Pair = { userId: string; postId: string };

// Like et Repost : un document par couple (utilisateur, post) et un compteur.
const REACTIONS = {
  like: {
    counter: "likesCount",
    create: (tx: Tx, data: Pair) => tx.like.create({ data }),
    remove: (tx: Tx, where: Pair) => tx.like.deleteMany({ where }),
  },
  repost: {
    counter: "repostsCount",
    create: (tx: Tx, data: Pair) => tx.repost.create({ data }),
    remove: (tx: Tx, where: Pair) => tx.repost.deleteMany({ where }),
  },
} as const;
type Reaction = keyof typeof REACTIONS;
type Counter = (typeof REACTIONS)[Reaction]["counter"] | "commentsCount";

/** Ajoute `by` au compteur ; renvoie false si le post n'existe pas (ou si le compteur est déjà à 0). */
async function bump(tx: Tx, postId: string, counter: Counter, by: 1 | -1) {
  const res = await tx.post.updateMany({
    where: by < 0 ? { id: postId, [counter]: { gt: 0 } } : { id: postId },
    data: { [counter]: { increment: by } },
  });
  return res.count === 1;
}

/** Renvoie true si la réaction est nouvelle. Lève NotFoundError si le post n'existe pas. */
async function addReaction(kind: Reaction, userId: Id, postId: Id) {
  const { counter, create } = REACTIONS[kind];
  const doc = { userId: toId(userId, "Utilisateur"), postId: toId(postId, "Post") };
  try {
    return await inTransaction(undefined, async (tx) => {
      if (!(await bump(tx, doc.postId, counter, 1))) throw new NotFoundError("Post");
      // Une réaction existante fait échouer l'insert (doublon) et annule l'incrément.
      await create(tx, doc);
      return true;
    });
  } catch (err) {
    if (isDuplicateKey(err)) return false;
    throw err;
  }
}

/** Renvoie true si une réaction a été retirée. */
function removeReaction(kind: Reaction, userId: Id, postId: Id) {
  const { counter, remove } = REACTIONS[kind];
  const doc = { userId: toId(userId, "Utilisateur"), postId: toId(postId, "Post") };
  return inTransaction(undefined, async (tx) => {
    const res = await remove(tx, doc);
    if (res.count !== 1) return false;
    await bump(tx, doc.postId, counter, -1);
    return true;
  });
}

export const likePost = (userId: Id, postId: Id) => addReaction("like", userId, postId);
export const unlikePost = (userId: Id, postId: Id) => removeReaction("like", userId, postId);
export const repostPost = (userId: Id, postId: Id) => addReaction("repost", userId, postId);
export const unrepostPost = (userId: Id, postId: Id) => removeReaction("repost", userId, postId);

/** Lève NotFoundError si le post n'existe pas. */
export function addComment(authorId: Id, postId: Id, text: string) {
  const data = { authorId: toId(authorId, "Utilisateur"), postId: toId(postId, "Post"), text };
  return inTransaction(undefined, async (tx) => {
    if (!(await bump(tx, data.postId, "commentsCount", 1))) throw new NotFoundError("Post");
    return tx.comment.create({ data });
  });
}

/** Seul l'auteur supprime son commentaire. Renvoie true si supprimé. */
export function removeComment(authorId: Id, commentId: Id) {
  const where = { id: toId(commentId, "Commentaire"), authorId: toId(authorId, "Utilisateur") };
  return inTransaction(undefined, async (tx) => {
    const comment = await tx.comment.findFirst({ where, select: { postId: true } });
    if (!comment) return false;
    const res = await tx.comment.deleteMany({ where });
    if (res.count !== 1) return false;
    await bump(tx, comment.postId, "commentsCount", -1);
    return true;
  });
}
