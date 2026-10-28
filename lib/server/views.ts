// Mise en forme des documents Prisma pour les réponses : forme du contrat d'API (lib/types.ts),
// ids publics seulement, jamais de hash ni de champ privé.
import { levelFor } from "../game";
import type { ArtVariant, PostAuthor, PostView, PublicUser, Stats } from "../types";
import {
  db,
  flowPagesToday,
  isOnline,
  likesToday,
  parisDay,
  serenityFor,
  type Post,
  type UserRow as User,
} from "../db";
import { formatAgo } from "./format";
import { pointEvent } from "./points";

type Profile = Pick<User, "id" | "username" | "displayName">;

export const displayName = (user: Pick<User, "username" | "displayName">) => user.displayName || user.username;

export const authUser = (user: Pick<User, "id" | "email" | "username">) => ({
  id: user.id,
  email: user.email,
  username: user.username,
});

export const author = (user: Profile): PostAuthor => ({ id: user.id, username: user.username, name: displayName(user) });

// Statut affiché sous le pseudo : calculé depuis la dernière activité.
function statusOf(user: Pick<User, "shielded" | "lastActiveAt">, now = Date.now()) {
  if (user.shielded) return "Bouclier actif";
  if (isOnline(user.lastActiveAt, now)) return "En ligne";
  if (!user.lastActiveAt) return "Hors ligne";
  const ago = formatAgo(user.lastActiveAt, now);
  return ago === "hier" ? "Connecté hier" : `Connecté ${ago}`;
}

export const followingIds = async (userId: string) =>
  (await db.follow.findMany({ where: { followerId: userId }, select: { followingId: true } })).map((f) => f.followingId);

const hasActiveStory = (authorId: string) =>
  db.story.count({ where: { authorId, expiresAt: { gt: new Date() } } }).then(Boolean);

export async function publicUser(user: User, viewerId?: string): Promise<PublicUser> {
  const [followers, following, hasInstant, followedByMe] = await Promise.all([
    db.follow.count({ where: { followingId: user.id } }),
    db.follow.count({ where: { followerId: user.id } }),
    hasActiveStory(user.id),
    viewerId && viewerId !== user.id
      ? db.follow.count({ where: { followerId: viewerId, followingId: user.id } }).then(Boolean)
      : undefined,
  ]);
  return {
    id: user.id,
    username: user.username,
    name: displayName(user),
    bio: user.bio,
    status: statusOf(user),
    level: levelFor(user.totalEarned),
    hasInstant,
    shielded: user.shielded,
    followers,
    following,
    ...(followedByMe === undefined ? {} : { followedByMe }),
  };
}

export async function stats(user: User): Promise<Stats> {
  const userId = user.id;
  const [spent, best, today, pages, likesGivenToday, pagesToday, dosesGiven, orders, spied, events] = await Promise.all([
    db.pointEvent.aggregate({ where: { userId, amount: { lt: 0 } }, _sum: { amount: true } }),
    db.pointEvent.aggregate({ where: { userId, amount: { gt: 0 } }, _max: { amount: true } }),
    db.pointEvent.aggregate({ where: { userId, amount: { gt: 0 }, day: parisDay() }, _sum: { amount: true } }),
    db.pointEvent.count({ where: { userId, type: "flow_page" } }),
    likesToday(userId),
    flowPagesToday(userId),
    db.like.count({ where: { userId } }),
    db.order.count({ where: { userId } }),
    db.skillPurchase.findMany({ where: { buyerId: userId }, distinct: ["targetId"], select: { targetId: true } }),
    db.pointEvent.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 60 }),
  ]);
  return {
    points: user.points,
    totalEarned: user.totalEarned,
    totalSpent: -(spent._sum.amount ?? 0),
    bestGain: best._max.amount ?? 0,
    earnedToday: today._sum.amount ?? 0,
    streak: user.streak?.current ?? 0,
    serenity: serenityFor(pagesToday, likesGivenToday),
    level: levelFor(user.totalEarned),
    flowPagesRead: pages,
    dosesGiven,
    orders,
    friendsSpied: spied.length,
    timeSpentMs: Math.round(user.timeSpentSec * 1000),
    events: events.map(pointEvent),
  };
}

const mediaUrl = (post: Post, kind: "image" | "video") =>
  post.mediaPath?.startsWith("/api/media/") && post.mediaMime?.startsWith(`${kind}/`) ? post.mediaPath : undefined;

// Plusieurs posts d'un coup : auteurs, commentaires, Bonnes doses et favoris lus en une requête chacun.
export async function postViews(posts: Post[], viewerId: string): Promise<PostView[]> {
  const ids = posts.map((post) => post.id);
  const [authors, comments, likes, saves] = await Promise.all([
    db.user.findMany({
      where: { id: { in: [...new Set(posts.map((post) => post.authorId))] } },
      select: { id: true, username: true, displayName: true },
    }),
    db.comment.findMany({
      where: { postId: { in: ids } },
      orderBy: { createdAt: "asc" },
      select: { postId: true, text: true, author: { select: { username: true } } },
    }),
    db.like.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true } }),
    db.save.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true } }),
  ]);
  const authorById = new Map(authors.map((user) => [user.id, user]));
  const commentsByPost = Map.groupBy(comments, (comment) => comment.postId);
  const liked = new Set(likes.map((like) => like.postId));
  const saved = new Set(saves.map((save) => save.postId));
  return posts.map((post) => {
    const postAuthor = authorById.get(post.authorId);
    return {
      id: post.id,
      authorId: post.authorId,
      author: postAuthor ? author(postAuthor) : null,
      location: post.location ?? "",
      ago: formatAgo(post.createdAt),
      art: post.art as ArtVariant,
      caption: post.caption,
      doses: post.baseLikes + post.likesCount,
      comments: (commentsByPost.get(post.id) ?? []).map((comment) => ({ author: comment.author.username, text: comment.text })),
      isReel: post.type === "reel",
      imageUrl: mediaUrl(post, "image"),
      videoUrl: mediaUrl(post, "video"),
      dosedByMe: liked.has(post.id),
      savedByMe: saved.has(post.id),
    };
  });
}

export const postView = async (post: Post, viewerId: string) => (await postViews([post], viewerId))[0];
