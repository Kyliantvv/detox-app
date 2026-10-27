import type { Types } from "mongoose";
import { Comment } from "./models/comment";
import { Like } from "./models/like";
import { Post } from "./models/post";

type Id = Types.ObjectId | string;

// Les compteurs de Post ne bougent que si le Like ou le Comment a vraiment été
// créé ou supprimé : un double clic ne compte qu'une fois et le compteur ne
// descend jamais sous 0.

/** Renvoie true si le like est nouveau. */
export async function likePost(userId: Id, postId: Id) {
  const res = await Like.updateOne({ userId, postId }, { $setOnInsert: { userId, postId } }, { upsert: true });
  if (res.upsertedCount !== 1) return false;
  await Post.updateOne({ _id: postId }, { $inc: { likesCount: 1 } });
  return true;
}

/** Renvoie true si un like a été retiré. */
export async function unlikePost(userId: Id, postId: Id) {
  const res = await Like.deleteOne({ userId, postId });
  if (res.deletedCount !== 1) return false;
  await Post.updateOne({ _id: postId, likesCount: { $gt: 0 } }, { $inc: { likesCount: -1 } });
  return true;
}

export async function addComment(authorId: Id, postId: Id, text: string) {
  const comment = await Comment.create({ authorId, postId, text });
  await Post.updateOne({ _id: postId }, { $inc: { commentsCount: 1 } });
  return comment;
}

/** Seul l'auteur supprime son commentaire. Renvoie true si supprimé. */
export async function removeComment(authorId: Id, commentId: Id) {
  const comment = await Comment.findOneAndDelete({ _id: commentId, authorId });
  if (!comment) return false;
  await Post.updateOne({ _id: comment.postId, commentsCount: { $gt: 0 } }, { $inc: { commentsCount: -1 } });
  return true;
}
