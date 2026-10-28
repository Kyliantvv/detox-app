// Mise en forme des documents de la DB pour les réponses : ids publics seulement, jamais de hash.
import { levelFor } from "../game";
import type { PostAuthor, PostView, PublicUser, Stats } from "../types";
import {
  accountOf,
  activeInstant,
  db,
  eventsOf,
  followersCount,
  followingOf,
  formatAgo,
  type DbPost,
  type DbUser,
} from "./db";

export const authUser = (user: DbUser) => ({ id: user.id, email: user.email, username: user.username });

export const author = (user: DbUser): PostAuthor => ({ id: user.id, username: user.username, name: user.name });

export const publicUser = (user: DbUser, viewerId?: string): PublicUser => ({
  id: user.id,
  username: user.username,
  name: user.name,
  bio: user.bio,
  status: user.status,
  level: levelFor(accountOf(user.id).totalEarned),
  hasInstant: Boolean(activeInstant(user.id)),
  shielded: user.shielded,
  followers: followersCount(user.id),
  following: followingOf(user.id).size,
  ...(viewerId && viewerId !== user.id ? { followedByMe: followingOf(viewerId).has(user.id) } : {}),
});

export function stats(userId: string): Stats {
  const account = accountOf(userId);
  const store = db();
  const likes = [...store.likes].filter((key) => key.startsWith(`${userId}:`)).length;
  const spied = Object.values(store.skills.get(userId) ?? {}).filter((skills) => skills.length > 0).length;
  return {
    points: account.points,
    totalEarned: account.totalEarned,
    totalSpent: account.totalSpent,
    bestGain: account.bestGain,
    earnedToday: account.earnedToday,
    streak: account.streak,
    serenity: account.serenity,
    level: levelFor(account.totalEarned),
    flowPagesRead: account.flowPagesRead.length,
    dosesGiven: likes,
    orders: store.orders.get(userId)?.length ?? 0,
    friendsSpied: spied,
    timeSpentMs: account.timeSpentMs,
    events: eventsOf(userId).slice(0, 60),
  };
}

export function postView(post: DbPost, viewerId: string): PostView {
  const store = db();
  const user = store.users.get(post.authorId);
  const media = post.mediaId ? store.media.get(post.mediaId) : undefined;
  const mediaUrl = post.mediaId ? `/api/media/${post.mediaId}` : undefined;
  const likes = [...store.likes].filter((key) => key.endsWith(`:${post.id}`)).length;
  return {
    id: post.id,
    authorId: post.authorId,
    author: user ? author(user) : null,
    location: post.location,
    ago: post.ago ?? formatAgo(post.createdAt),
    art: post.art,
    caption: post.caption,
    doses: post.baseDoses + likes,
    comments: (store.comments.get(post.id) ?? []).map(({ author, text }) => ({ author, text })),
    isReel: post.isReel,
    imageUrl: media?.type.startsWith("image/") ? mediaUrl : undefined,
    videoUrl: media?.type.startsWith("video/") ? mediaUrl : undefined,
    dosedByMe: store.likes.has(`${viewerId}:${post.id}`),
    savedByMe: store.saves.has(`${viewerId}:${post.id}`),
  };
}
