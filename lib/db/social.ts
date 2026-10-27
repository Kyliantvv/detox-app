import { NotFoundError, isDuplicateKey } from "./errors";
import { type Id, inTransaction, toObjectId } from "./ids";
import { Comment } from "./models/comment";
import { Like } from "./models/like";
import { Post } from "./models/post";
import { Repost } from "./models/repost";

// Le Like, le Repost ou le Comment et le compteur du Post s'écrivent dans la
// même transaction. Les compteurs ne bougent que si le document a vraiment été
// créé ou supprimé : un double clic ne compte qu'une fois et le compteur ne
// descend jamais sous 0.

// Like et Repost : un document par couple (utilisateur, post) et un compteur.
const REACTIONS = {
  like: { model: Like, counter: "likesCount" },
  repost: { model: Repost, counter: "repostsCount" },
} as const;
type Reaction = keyof typeof REACTIONS;

/** Renvoie true si la réaction est nouvelle. Lève NotFoundError si le post n'existe pas. */
async function addReaction(kind: Reaction, userId: Id, postId: Id) {
  const { model, counter } = REACTIONS[kind];
  const doc = { userId: toObjectId(userId, "Utilisateur"), postId: toObjectId(postId, "Post") };
  try {
    return await inTransaction(undefined, async (session) => {
      const post = await Post.updateOne({ _id: doc.postId }, { $inc: { [counter]: 1 } }, { session });
      if (post.matchedCount !== 1) throw new NotFoundError("Post");
      // Une réaction existante fait échouer l'insert (E11000) et annule le $inc.
      await model.create([doc], { session });
      return true;
    });
  } catch (err) {
    if (isDuplicateKey(err)) return false;
    throw err;
  }
}

/** Renvoie true si une réaction a été retirée. */
function removeReaction(kind: Reaction, userId: Id, postId: Id) {
  const { model, counter } = REACTIONS[kind];
  const doc = { userId: toObjectId(userId, "Utilisateur"), postId: toObjectId(postId, "Post") };
  return inTransaction(undefined, async (session) => {
    const res = await model.deleteOne(doc, { session });
    if (res.deletedCount !== 1) return false;
    await Post.updateOne({ _id: doc.postId, [counter]: { $gt: 0 } }, { $inc: { [counter]: -1 } }, { session });
    return true;
  });
}

export const likePost = (userId: Id, postId: Id) => addReaction("like", userId, postId);
export const unlikePost = (userId: Id, postId: Id) => removeReaction("like", userId, postId);
export const repostPost = (userId: Id, postId: Id) => addReaction("repost", userId, postId);
export const unrepostPost = (userId: Id, postId: Id) => removeReaction("repost", userId, postId);

/** Lève NotFoundError si le post n'existe pas. */
export function addComment(authorId: Id, postId: Id, text: string) {
  const doc = { authorId: toObjectId(authorId, "Utilisateur"), postId: toObjectId(postId, "Post"), text };
  return inTransaction(undefined, async (session) => {
    const post = await Post.updateOne({ _id: doc.postId }, { $inc: { commentsCount: 1 } }, { session });
    if (post.matchedCount !== 1) throw new NotFoundError("Post");
    const [comment] = await Comment.create([doc], { session });
    return comment;
  });
}

/** Seul l'auteur supprime son commentaire. Renvoie true si supprimé. */
export function removeComment(authorId: Id, commentId: Id) {
  const filter = { _id: toObjectId(commentId, "Commentaire"), authorId: toObjectId(authorId, "Utilisateur") };
  return inTransaction(undefined, async (session) => {
    const comment = await Comment.findOneAndDelete(filter, { session });
    if (!comment) return false;
    await Post.updateOne({ _id: comment.postId, commentsCount: { $gt: 0 } }, { $inc: { commentsCount: -1 } }, { session });
    return true;
  });
}
