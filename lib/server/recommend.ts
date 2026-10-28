// Algorithme de recommandation du Flow et des Reels, volontairement « addictif » (c'est la parodie) :
// il pousse ce que tu aimes déjà, ce qui est populaire, et une part de hasard pour la récompense variable.
// Il ne se base que sur le comportement : Bonnes doses, enregistrements, commentaires, visites, abonnements.
import type { ArtVariant } from "../types";
import { type DbPost, db, findPost, followingOf } from "./db";

// Poids de chaque action dans le profil de goûts : [affinité auteur, affinité visuel].
export const WEIGHTS = {
  like: [3, 1],
  save: [4, 2],
  comment: [5, 1],
  profileView: [2, 0],
  follow: [6, 0],
} as const;

// Réserve de posts générés examinée pour chaque page du Flow, et posts gardés (dont 1 surprise).
export const FLOW_POOL = 20;
export const FLOW_PER_PAGE = 5;
// Amplitude du hasard ajouté à chaque score : la « récompense variable ».
export const JITTER = 2;

export const REASONS = {
  surprise: "Une surprise, rien que pour toi",
  art: "Parce que tu aimes ce genre de visuel",
  popular: "Populaire en ce moment",
  interest: (name: string) => `Parce que tu t'intéresses à ${name}`,
  follow: (name: string) => `Parce que tu suis ${name}`,
};

export type Recommendation = { post: DbPost; reason: string };

type Taste = {
  authors: Map<string, number>;
  arts: Map<ArtVariant, number>;
  // Auteurs avec qui l'utilisateur a vraiment interagi (pas seulement suivis), pour choisir la raison.
  engaged: Set<string>;
  followed: Set<string>;
};

const add = <K>(map: Map<K, number>, key: K, amount: number) => map.set(key, (map.get(key) ?? 0) + amount);

// Profil de goûts, recalculé à chaque appel depuis la base : il suit chaque nouveau like en direct.
export function tasteOf(userId: string): Taste {
  const store = db();
  const user = store.users.get(userId);
  const taste: Taste = { authors: new Map(), arts: new Map(), engaged: new Set(), followed: followingOf(userId) };

  const interact = (postId: string, [author, art]: readonly [number, number]) => {
    const post = findPost(postId);
    if (!post || post.authorId === userId) return;
    add(taste.authors, post.authorId, author);
    add(taste.arts, post.art, art);
    taste.engaged.add(post.authorId);
  };

  const prefix = `${userId}:`;
  for (const key of store.likes) if (key.startsWith(prefix)) interact(key.slice(prefix.length), WEIGHTS.like);
  for (const key of store.saves) if (key.startsWith(prefix)) interact(key.slice(prefix.length), WEIGHTS.save);
  for (const [postId, comments] of store.comments) {
    for (const comment of comments) if (comment.author === user?.username) interact(postId, WEIGHTS.comment);
  }
  for (const [profileId, count] of store.profileViews.get(userId) ?? []) {
    add(taste.authors, profileId, WEIGHTS.profileView[0] * count);
    taste.engaged.add(profileId);
  }
  for (const authorId of taste.followed) add(taste.authors, authorId, WEIGHTS.follow[0]);
  return taste;
}

const popularity = (post: DbPost) => Math.log10(1 + post.baseDoses);

// Score d'un post et raison affichée : la plus grosse part du score (auteur, visuel ou popularité) l'emporte.
export function scorePost(post: DbPost, taste: Taste): { score: number; reason: string } {
  const author = taste.authors.get(post.authorId) ?? 0;
  const art = taste.arts.get(post.art) ?? 0;
  const score = author + art + popularity(post) + Math.random() * JITTER;

  const name = db().users.get(post.authorId)?.name ?? "ce compte";
  let reason = REASONS.popular;
  if (author > 0 && author >= art) {
    reason = taste.engaged.has(post.authorId) ? REASONS.interest(name) : REASONS.follow(name);
  } else if (art > 0) {
    reason = REASONS.art;
  }
  return { score, reason };
}

// Trie des posts du plus au moins recommandé.
export function rank(posts: DbPost[], userId: string): Recommendation[] {
  const taste = tasteOf(userId);
  return posts
    .map((post) => ({ post, ...scorePost(post, taste) }))
    .sort((a, b) => b.score - a.score)
    .map(({ post, reason }) => ({ post, reason }));
}

// Page N du Flow pour un utilisateur : les meilleurs posts d'une réserve de FLOW_POOL posts générés,
// plus 1 surprise tirée au hasard dans le reste. Chaque page a sa propre réserve (f20N…f20N+19) :
// un post n'est jamais proposé deux fois. La page est mémorisée pour rester identique si on la relit.
export function flowRecommendations(userId: string, page: number): Recommendation[] {
  const pages = db().flowPages;
  const userPages = pages.get(userId) ?? new Map<number, { id: string; reason: string }[]>();
  pages.set(userId, userPages);

  let picked = userPages.get(page);
  if (!picked) {
    const pool = Array.from({ length: FLOW_POOL }, (_, i) => findPost(`f${page * FLOW_POOL + i}`)!);
    const ranked = rank(pool, userId);
    const best = ranked.slice(0, FLOW_PER_PAGE - 1);
    const rest = ranked.slice(FLOW_PER_PAGE - 1);
    const surprise = { post: rest[Math.floor(Math.random() * rest.length)].post, reason: REASONS.surprise };
    const at = Math.floor(Math.random() * FLOW_PER_PAGE);
    const chosen = [...best.slice(0, at), surprise, ...best.slice(at)];
    picked = chosen.map(({ post, reason }) => ({ id: post.id, reason }));
    userPages.set(page, picked);
  }
  return picked.map(({ id, reason }) => ({ post: findPost(id)!, reason }));
}

// Reels triés pour l'utilisateur, y compris ceux publiés par les comptes.
export function reelRecommendations(userId: string): Recommendation[] {
  const reels = [...db().posts.values()].filter((post) => post.isReel);
  return rank(reels, userId);
}
