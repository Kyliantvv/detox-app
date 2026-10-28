// Algorithme de recommandation du Flow et des Reels, conçu pour maximiser l'engagement :
// il pousse ce que tu aimes déjà, ce qui est populaire, et une part de hasard pour la récompense variable.
// Il ne se base que sur le comportement : Bonnes doses, enregistrements, commentaires, visites, abonnements.
import { FLOW_PER_PAGE } from "../game";
import { db, isDuplicateKey, type Art, type Post } from "../db";
import { visibleWhere } from "./posts";
import { displayName } from "./views";

// Poids de chaque action dans le profil de goûts : [affinité auteur, affinité visuel].
const WEIGHTS = {
  like: [3, 1],
  save: [4, 2],
  comment: [5, 1],
  profileView: [2, 0],
  follow: [6, 0],
} as const;

// Posts examinés pour chaque page du Flow, et posts gardés (dont 1 surprise).
const FLOW_POOL = 20;
export { FLOW_PER_PAGE };
// Amplitude du hasard ajouté à chaque score : la « récompense variable ».
const JITTER = 2;
// Interactions récentes prises en compte dans le profil de goûts, par type.
const HISTORY = 500;

export const REASONS = {
  surprise: "Une surprise, rien que pour toi",
  art: "Parce que tu aimes ce genre de visuel",
  popular: "Populaire en ce moment",
  interest: (name: string) => `Parce que tu t'intéresses à ${name}`,
  follow: (name: string) => `Parce que tu suis ${name}`,
};

export type Recommendation = { post: Post; reason: string };

export type Taste = {
  authors: Map<string, number>;
  arts: Map<Art, number>;
  // Auteurs avec qui l'utilisateur a vraiment interagi (pas seulement suivis), pour choisir la raison.
  engaged: Set<string>;
  followed: Set<string>;
};

const add = <K>(map: Map<K, number>, key: K, amount: number) => map.set(key, (map.get(key) ?? 0) + amount);

// Profil de goûts, recalculé à chaque appel depuis la base : il suit chaque nouveau like en direct.
export async function tasteOf(userId: string): Promise<Taste> {
  const recent = { where: { userId }, orderBy: { createdAt: "desc" as const }, take: HISTORY };
  const target = { select: { post: { select: { authorId: true, art: true } } } };
  const [likes, saves, comments, views, follows] = await Promise.all([
    db.like.findMany({ ...recent, ...target }),
    db.save.findMany({ ...recent, ...target }),
    db.comment.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      take: HISTORY,
      ...target,
    }),
    db.profileView.groupBy({ by: ["profileId"], where: { viewerId: userId }, _count: { _all: true } }),
    db.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
  ]);
  const taste: Taste = {
    authors: new Map(),
    arts: new Map(),
    engaged: new Set(),
    followed: new Set(follows.map((follow) => follow.followingId)),
  };

  const interact = (post: { authorId: string; art: Art }, [author, art]: readonly [number, number]) => {
    if (post.authorId === userId) return;
    add(taste.authors, post.authorId, author);
    add(taste.arts, post.art, art);
    taste.engaged.add(post.authorId);
  };
  for (const { post } of likes) interact(post, WEIGHTS.like);
  for (const { post } of saves) interact(post, WEIGHTS.save);
  for (const { post } of comments) interact(post, WEIGHTS.comment);
  for (const { profileId, _count } of views) {
    add(taste.authors, profileId, WEIGHTS.profileView[0] * _count._all);
    taste.engaged.add(profileId);
  }
  for (const authorId of taste.followed) add(taste.authors, authorId, WEIGHTS.follow[0]);
  return taste;
}

const popularity = (post: Post) => Math.log10(1 + post.baseLikes + post.likesCount);

// Score d'un post et raison affichée : la plus grosse part du score (auteur, visuel ou popularité) l'emporte.
export function scorePost(post: Post, taste: Taste, names: Map<string, string>): { score: number; reason: string } {
  const author = taste.authors.get(post.authorId) ?? 0;
  const art = taste.arts.get(post.art) ?? 0;
  const score = author + art + popularity(post) + Math.random() * JITTER;

  const name = names.get(post.authorId) ?? "ce compte";
  let reason = REASONS.popular;
  if (author > 0 && author >= art) {
    reason = taste.engaged.has(post.authorId) ? REASONS.interest(name) : REASONS.follow(name);
  } else if (art > 0) {
    reason = REASONS.art;
  }
  return { score, reason };
}

// Trie des posts du plus au moins recommandé.
export async function rank(posts: Post[], userId: string): Promise<Recommendation[]> {
  const taste = await tasteOf(userId);
  const authors = await db.user.findMany({
    where: { id: { in: [...new Set(posts.map((post) => post.authorId))] } },
    select: { id: true, username: true, displayName: true },
  });
  const names = new Map(authors.map((user) => [user.id, displayName(user)]));
  return posts
    .map((post) => ({ post, ...scorePost(post, taste, names) }))
    .sort((a, b) => b.score - a.score)
    .map(({ post, reason }) => ({ post, reason }));
}

// Réserve de la page N : FLOW_POOL photos des autres comptes, du plus récent au plus ancien.
// Le Flow est infini : arrivé au bout, il repart du début de la liste.
async function flowPool(userId: string, page: number) {
  const where = { AND: [{ type: "photo" as const, authorId: { not: userId } }, await visibleWhere(userId)] };
  const total = await db.post.count({ where });
  if (!total) return [];
  const size = Math.min(FLOW_POOL, total);
  const start = (page * FLOW_POOL) % total;
  const ordered = { where, orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }] };
  const head = await db.post.findMany({ ...ordered, skip: start, take: size });
  const tail = head.length < size ? await db.post.findMany({ ...ordered, take: size - head.length }) : [];
  return [...head, ...tail];
}

// Page N du Flow pour un utilisateur : les meilleurs posts de la réserve, plus 1 surprise tirée au hasard
// dans le reste. La page est mémorisée (FlowPage) pour rester identique si on la relit.
export async function flowRecommendations(userId: string, page: number): Promise<Recommendation[]> {
  let stored = await db.flowPage.findUnique({ where: { userId_page: { userId, page } } });
  if (!stored) {
    const ranked = await rank(await flowPool(userId, page), userId);
    const best = ranked.slice(0, FLOW_PER_PAGE - 1);
    const rest = ranked.slice(FLOW_PER_PAGE - 1);
    let chosen = ranked.slice(0, FLOW_PER_PAGE);
    if (rest.length) {
      const surprise = { post: rest[Math.floor(Math.random() * rest.length)].post, reason: REASONS.surprise };
      const at = Math.floor(Math.random() * FLOW_PER_PAGE);
      chosen = [...best.slice(0, at), surprise, ...best.slice(at)];
    }
    const picks = chosen.map(({ post, reason }) => ({ postId: post.id, reason }));
    try {
      stored = await db.flowPage.create({ data: { userId, page, picks } });
    } catch (error) {
      // Même page demandée deux fois en même temps : on garde la première.
      if (!isDuplicateKey(error)) throw error;
      stored = await db.flowPage.findUniqueOrThrow({ where: { userId_page: { userId, page } } });
    }
  }
  const posts = await db.post.findMany({ where: { id: { in: stored.picks.map((pick) => pick.postId) } } });
  const byId = new Map(posts.map((post) => [post.id, post]));
  // Un post supprimé depuis disparaît de la page.
  return stored.picks.flatMap(({ postId, reason }) => {
    const post = byId.get(postId);
    return post ? [{ post, reason }] : [];
  });
}

// Reels triés pour l'utilisateur, parmi les plus récents.
export async function reelRecommendations(userId: string): Promise<Recommendation[]> {
  const reels = await db.post.findMany({
    where: { AND: [{ type: "reel" }, await visibleWhere(userId)] },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rank(reels, userId);
}
