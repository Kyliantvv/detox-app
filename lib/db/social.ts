import mongoose, { type Types } from "mongoose";
import { NotFoundError } from "./errors";
import { Comment } from "./models/comment";
import { Like } from "./models/like";
import { Post } from "./models/post";

type Id = Types.ObjectId | string;

// Le Like ou le Comment et le compteur du Post s'écrivent dans la même
// transaction. Les compteurs ne bougent que si le Like ou le Comment a vraiment
// été créé ou supprimé : un double clic ne compte qu'une fois et le compteur
// ne descend jamais sous 0.

/** Renvoie true si le like est nouveau. Lève NotFoundError si le post n'existe pas. */
export async function likePost(userId: Id, postId: Id) {
  let created = false;
  try {
    await mongoose.connection.transaction(async (session) => {
      const post = await Post.updateOne({ _id: postId }, { $inc: { likesCount: 1 } }, { session });
      if (post.matchedCount !== 1) throw new NotFoundError("Post");
      // Un like existant fait échouer l'insert (E11000) et annule le $inc.
      await Like.create([{ userId, postId }], { session });
      created = true;
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return false;
    throw err;
  }
  return created;
}

/** Renvoie true si un like a été retiré. */
export async function unlikePost(userId: Id, postId: Id) {
  let removed = false;
  await mongoose.connection.transaction(async (session) => {
    const res = await Like.deleteOne({ userId, postId }, { session });
    removed = res.deletedCount === 1;
    if (removed) await Post.updateOne({ _id: postId, likesCount: { $gt: 0 } }, { $inc: { likesCount: -1 } }, { session });
  });
  return removed;
}

/** Lève NotFoundError si le post n'existe pas. */
export async function addComment(authorId: Id, postId: Id, text: string) {
  let comment: InstanceType<typeof Comment> | undefined;
  await mongoose.connection.transaction(async (session) => {
    const post = await Post.updateOne({ _id: postId }, { $inc: { commentsCount: 1 } }, { session });
    if (post.matchedCount !== 1) throw new NotFoundError("Post");
    [comment] = await Comment.create([{ authorId, postId, text }], { session });
  });
  return comment!;
}

/** Seul l'auteur supprime son commentaire. Renvoie true si supprimé. */
export async function removeComment(authorId: Id, commentId: Id) {
  let removed = false;
  await mongoose.connection.transaction(async (session) => {
    const comment = await Comment.findOneAndDelete({ _id: commentId, authorId }, { session });
    removed = !!comment;
    if (comment) {
      await Post.updateOne({ _id: comment.postId, commentsCount: { $gt: 0 } }, { $inc: { commentsCount: -1 } }, { session });
    }
  });
  return removed;
}
