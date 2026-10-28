import type { Art, AvatarColor, PostType, Prisma, Visibility } from "@prisma/client";
import { parisDay } from "../lib/db/time";

// Fausses données pour `pnpm db:seed`. Pur et déterministe : une même graine
// (et un même `now`) donne les mêmes données.

/** Domaine des comptes de seed : le seed supprime ces comptes, et eux seuls, avant de les recréer. */
export const SEED_EMAIL_DOMAIN = "seed.detox.local";

/** Mot de passe de tous les comptes de seed. */
export const SEED_PASSWORD = "detox1234";
// scrypt de SEED_PASSWORD, calculé une fois au format de lib/server/password.ts.
const SEED_PASSWORD_HASH =
  "aea951add24a16e2b17677d85139711a:6ad8d06611f6879dae0d8d1f8bbfa8fee0592a327c4f5897a34ae7d737b5f774";

const DAY_MS = 24 * 60 * 60 * 1000;

const FIRST_NAMES = [
  "Léa", "Hugo", "Chloé", "Lucas", "Manon", "Nathan", "Inès", "Enzo", "Camille", "Louis",
  "Sarah", "Gabriel", "Jade", "Raphaël", "Emma", "Arthur", "Lina", "Jules", "Zoé", "Adam",
  "Mila", "Noah", "Lou", "Théo", "Alice", "Yanis", "Rose", "Sacha", "Ambre", "Malo",
];
const LAST_NAMES = [
  "Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau",
  "Simon", "Laurent", "Lefèvre", "Michel", "Garcia", "David", "Bertrand", "Roux", "Vincent", "Fournier",
  "Morel", "Girard", "André", "Mercier", "Dupont", "Lambert", "Bonnet", "François", "Martinez", "Faure",
];
const BIOS = [
  "", "Je scrolle donc je suis.", "Accro au café et aux stories.", "Étudiant·e, fatigué·e.",
  "Ici pour les points.", "Détox ? Demain.", "Photos de chats et de couchers de soleil.",
  "Série en cours : ne pas casser.", "Je like tout, désolé·e.", "Lyon ↔ Paris",
];
const CAPTIONS = [
  "Encore un dimanche au soleil ☀️", "Vue imprenable ce matin", "Le meilleur brunch de la ville",
  "Petit tour en montagne", "Ça, c'est fait.", "Je ne m'en lasse pas", "Nouvelle coupe, qu'en dites-vous ?",
  "Throwback à cet été", "Séance de sport du jour 💪", "Coucher de soleil sans filtre",
  "Ma playlist du moment tourne en boucle", "Premier essai, soyez indulgents", "On refait le monde en terrasse",
  "Week-end loin des écrans (ou presque)", "Quelqu'un reconnaît l'endroit ?", "",
];
const TAGS = ["voyage", "food", "sport", "mode", "nature", "art", "musique", "chill", "ville", "animaux"];
const LOCATIONS = ["Paris", "Lyon", "Marseille", "Bordeaux", "Lille", "Nantes", "Toulouse", "Nice", "Annecy", "Biarritz"];
const AVATAR_COLORS: AvatarColor[] = ["pink", "yellow", "green", "purple", "grey"];
const ARTS: Art[] = ["sunset", "moon", "triangle", "diamond", "pill", "ring", "square", "dome", "dot", "waves"];

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (max: number) => Math.floor(next() * max);
  const pick = <T>(list: readonly T[]) => list[int(list.length)];
  const chance = (p: number) => next() < p;
  return { next, int, pick, chance };
}
export type Rng = ReturnType<typeof createRng>;

/** ObjectId dont l'horodatage est `date`, le reste tiré de `rng`. */
function objectId(date: Date, rng: Rng) {
  const time = Math.floor(date.getTime() / 1000).toString(16).padStart(8, "0");
  return time + Array.from({ length: 16 }, () => rng.int(16).toString(16)).join("");
}

/** Date au hasard entre `from` et `to`. */
const between = (from: Date, to: Date, rng: Rng) => new Date(from.getTime() + rng.int(to.getTime() - from.getTime() + 1));

/** `k` éléments distincts de `list`, sans `except`. */
function sample<T>(list: readonly T[], k: number, rng: Rng, except?: T) {
  const max = list.length - (except !== undefined && list.includes(except) ? 1 : 0);
  const out = new Set<T>();
  while (out.size < Math.min(k, max)) {
    const item = rng.pick(list);
    if (item !== except) out.add(item);
  }
  return [...out];
}

/** Sans accents ni caractères spéciaux, pour les pseudos et les e-mails. */
const slug = (s: string) => s.normalize("NFD").replace(/[^a-zA-Z]/g, "").toLowerCase();

type WithId<T> = T & { id: string; createdAt: Date };
export type FakeUser = WithId<Prisma.UserCreateManyInput>;
export type FakePost = WithId<Prisma.PostCreateManyInput>;

export function fakeUsers(count: number, rng: Rng, now = new Date()): FakeUser[] {
  return Array.from({ length: count }, (_, i) => {
    const first = rng.pick(FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);
    // L'index garantit l'unicité ; le pseudo reste sous les 30 caractères.
    const username = `${slug(first)}.${slug(last)}${i + 1}`;
    // Inscrits entre 60 et 120 jours avant `now`.
    const createdAt = new Date(now.getTime() - (60 + rng.int(60)) * DAY_MS);
    return {
      id: objectId(createdAt, rng),
      email: `${username}@${SEED_EMAIL_DOMAIN}`,
      username,
      passwordHash: SEED_PASSWORD_HASH,
      displayName: `${first} ${last}`,
      bio: rng.pick(BIOS),
      avatarColor: rng.pick(AVATAR_COLORS),
      createdAt,
    };
  });
}

/** Posts répartis au hasard entre `authorIds`, publiés sur les 60 derniers jours. */
export function fakePosts(count: number, authorIds: string[], rng: Rng, now = new Date()): FakePost[] {
  if (count > 0 && authorIds.length === 0) throw new Error("Pas d'auteur pour les posts");
  return Array.from({ length: count }, (_, i) => {
    const type: PostType = rng.chance(0.2) ? "reel" : "photo";
    const visibility: Visibility = rng.chance(0.1) ? "closeFriends" : "public";
    const tags = [...new Set(Array.from({ length: rng.int(3) }, () => rng.pick(TAGS)))];
    const createdAt = new Date(now.getTime() - rng.int(60 * DAY_MS));
    return {
      id: objectId(createdAt, rng),
      authorId: rng.pick(authorIds),
      type,
      // Chemins fictifs : aucun fichier n'est envoyé sur UploadThing.
      mediaPath: `seed/${type}-${(i % 50) + 1}.${type === "reel" ? "mp4" : "jpg"}`,
      mediaMime: type === "reel" ? "video/mp4" : "image/jpeg",
      caption: rng.pick(CAPTIONS),
      location: rng.chance(0.5) ? rng.pick(LOCATIONS) : undefined,
      tags,
      visibility,
      art: rng.pick(ARTS),
      createdAt,
    };
  });
}

/** Chaque utilisateur suit entre 0 et 2 × `perUser` autres comptes. */
export function fakeFollows(users: FakeUser[], perUser: number, rng: Rng, now = new Date()): Prisma.FollowCreateManyInput[] {
  const byId = new Map(users.map((u) => [u.id, u]));
  const ids = [...byId.keys()];
  return users.flatMap((follower) =>
    sample(ids, rng.int(2 * perUser + 1), rng, follower.id).map((followingId) => {
      const since = Math.max(follower.createdAt.getTime(), byId.get(followingId)!.createdAt.getTime());
      return { followerId: follower.id, followingId, createdAt: between(new Date(since), now, rng) };
    }),
  );
}

/** Chaque post reçoit entre 0 et 2 × `perPost` likes, jamais de son auteur. */
export function fakeLikes(posts: FakePost[], userIds: string[], perPost: number, rng: Rng, now = new Date()): WithId<Prisma.LikeCreateManyInput>[] {
  return posts.flatMap((post) =>
    sample(userIds, rng.int(2 * perPost + 1), rng, post.authorId).map((userId) => {
      const createdAt = between(post.createdAt, now, rng);
      return { id: objectId(createdAt, rng), userId, postId: post.id, createdAt };
    }),
  );
}

export const POINTS = { daily_login: 25, flow_page: 10, like: 2 } as const;
const LABELS = { daily_login: "Connexion du jour", flow_page: "Page du Flow", like: "Bonne dose donnée" } as const;

/**
 * Historique de points d'un utilisateur, de son inscription à `now` : une
 * connexion quotidienne un jour sur deux environ, 0 à 5 pages de Flow ces
 * jours-là, et une Bonne dose par like donné. Son solde en est la somme.
 */
export function fakePointEvents(user: FakeUser, likesGiven: WithId<Prisma.LikeCreateManyInput>[], rng: Rng, now = new Date()) {
  const events: Prisma.PointEventCreateManyInput[] = [];
  const add = (type: keyof typeof POINTS, createdAt: Date, extra: { flowPage?: number; refId?: string } = {}) =>
    events.push({ userId: user.id, type, amount: POINTS[type], label: LABELS[type], day: parisDay(createdAt), createdAt, ...extra });

  const days = new Set<string>();
  let flowPage = 0;
  for (let t = user.createdAt.getTime(); t <= now.getTime(); t += DAY_MS) {
    const login = between(new Date(t), new Date(Math.min(t + DAY_MS - 1, now.getTime())), rng);
    // Un pas de 24 h peut retomber sur le même jour de Paris au changement d'heure.
    if (!rng.chance(0.6) || days.has(parisDay(login))) continue;
    days.add(parisDay(login));
    add("daily_login", login);
    for (let page = rng.int(6), at = login.getTime(); page > 0; page--) {
      at += 60_000 + rng.int(5 * 60_000);
      if (at <= now.getTime()) add("flow_page", new Date(at), { flowPage: ++flowPage });
    }
  }
  for (const like of likesGiven) add("like", like.createdAt, { refId: like.postId });
  return events;
}

export type SeedCounts = { users: number; posts: number; followsPerUser: number; likesPerPost: number };

/** Toutes les données de démo, cohérentes entre elles : compteurs de likes et soldes justes. */
export function fakeSeed(counts: SeedCounts, rng: Rng, now = new Date()) {
  const users = fakeUsers(counts.users, rng, now);
  const userIds = users.map((u) => u.id);
  const posts = fakePosts(counts.posts, userIds, rng, now);
  const follows = fakeFollows(users, counts.followsPerUser, rng, now);
  const likes = fakeLikes(posts, userIds, counts.likesPerPost, rng, now);

  const likesCount = Map.groupBy(likes, (l) => l.postId);
  const likesGiven = Map.groupBy(likes, (l) => l.userId);
  for (const post of posts) post.likesCount = likesCount.get(post.id)?.length ?? 0;
  const pointEvents = users.flatMap((user) => {
    const events = fakePointEvents(user, likesGiven.get(user.id) ?? [], rng, now);
    user.points = user.totalEarned = events.reduce((sum, e) => sum + e.amount, 0);
    return events;
  });
  return { users, posts, follows, likes, pointEvents };
}
