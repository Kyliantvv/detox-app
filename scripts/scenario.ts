import type { Art, Prisma, ShopItemKind } from "@prisma/client";
import type { Db } from "../lib/db/client";
import { parisDay } from "../lib/db/time";
import { hashPassword } from "../lib/server/password";
import { purge } from "./purge";

// Comptes et contenus de la maquette : compte démo (alex), amis bots, posts, Instants et boutique.
// `pnpm db:seed` les recrée à chaque lancement ; les tests de routes repartent de cet état.
// Les ids sont fixes : les tests visent `USERS.lina`, `POSTS.c1`…

/** Domaine des comptes de la maquette, supprimés et recréés par le seed. */
export const SCENARIO_EMAIL_DOMAIN = "detox.test";
export const SCENARIO_PASSWORD = "demo1234";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const id = (prefix: string, n: number) => prefix + n.toString(16).padStart(24 - prefix.length, "0");

type Friend = {
  key: string;
  username: string;
  name: string;
  bio: string;
  level: number;
  points: number;
  streak: number;
  lastActiveAgo: number;
  shielded?: boolean;
};

const FRIENDS: Friend[] = [
  { key: "lina", username: "lina.m", name: "Lina", bio: "En ligne", level: 12, points: 1870, streak: 6, lastActiveAgo: 0 },
  { key: "karim", username: "karim.zen", name: "Karim", bio: "Connecté il y a 4 min", level: 18, points: 3120, streak: 14, lastActiveAgo: 4 * MIN },
  { key: "ines", username: "ines.lofi", name: "Inès", bio: "Connectée il y a 1 h", level: 7, points: 640, streak: 2, lastActiveAgo: HOUR },
  { key: "sam", username: "sam.off", name: "Sam", bio: "Bouclier actif · 5 h 12", level: 4, points: 210, streak: 1, lastActiveAgo: 5 * HOUR, shielded: true },
  { key: "noah", username: "noah.detox", name: "Noah", bio: "Connecté hier", level: 9, points: 2455, streak: 9, lastActiveAgo: DAY },
];

/** Ids des comptes de la maquette, par prénom. */
export const USERS = {
  alex: id("64a0", 1),
  ...Object.fromEntries(FRIENDS.map((friend, i) => [friend.key, id("64a0", i + 2)])),
} as Record<"alex" | "lina" | "karim" | "ines" | "sam" | "noah", string>;

type ScenarioPost = {
  key: string;
  author: keyof typeof USERS;
  location: string;
  ago: number;
  art: Art;
  caption: string;
  likes: number;
  tags?: string[];
  reel?: boolean;
  comments?: { author: keyof typeof USERS; text: string }[];
};

const CIRCLE_POSTS: ScenarioPost[] = [
  {
    key: "c1", author: "lina", location: "Quiberon", ago: 3 * MIN, art: "sunset", likes: 1248, tags: ["voyage"],
    caption: "Jour 6 de vacances à Quiberon. Je me sens très détendue.",
    comments: [{ author: "karim", text: "Magnifique, profite bien !" }],
  },
  { key: "c2", author: "karim", location: "Lyon", ago: 22 * MIN, art: "moon", likes: 864, caption: "Méditation du matin au bord du Rhône." },
  {
    key: "c3", author: "ines", location: "Nantes", ago: HOUR, art: "waves", likes: 412, tags: ["voyage"],
    caption: "Petite pause au bord de l'eau.",
    comments: [{ author: "lina", text: "Inspirant." }],
  },
  { key: "c4", author: "noah", location: "Paris", ago: 3 * HOUR, art: "diamond", likes: 2031, caption: "J'ai gagné 300 pts en une soirée. Belle série !" },
];

const REELS: ScenarioPost[] = [
  { key: "r1", author: "karim", location: "Lyon", ago: 8 * MIN, art: "ring", likes: 5120, caption: "POV : ta première journée à la montagne.", reel: true },
  { key: "r2", author: "lina", location: "Quiberon", ago: HOUR, art: "sunset", likes: 9832, caption: "Coucher de soleil sur la côte.", reel: true },
  { key: "r3", author: "ines", location: "Nantes", ago: 2 * HOUR, art: "dome", likes: 3307, caption: "Ma routine bien-être du matin.", reel: true },
  { key: "r4", author: "noah", location: "Paris", ago: DAY, art: "triangle", likes: 12400, caption: "Tutoriel : mon café maison en 3 minutes.", reel: true },
];

const FLOW_ARTS: Art[] = ["triangle", "ring", "square", "dome", "dot", "pill", "sunset", "moon", "diamond", "waves"];
const FLOW_CAPTIONS = [
  "Un dimanche comme on les aime.",
  "Sortie running de ce matin.",
  "Petite découverte du jour.",
  "Ma série tient bon, merci à vous !",
  "Un coin tranquille pour travailler.",
  "Lever de soleil sur la ville.",
  "Une Bonne dose pour ce paysage ?",
];
const FLOW_PLACES = ["Marseille", "Lille", "Bordeaux", "Rennes", "Toulouse", "Nice", "Brest"];
const FLOW_AUTHORS = ["lina", "karim", "ines", "noah", "sam"] as const;
const FLOW_TAGS = [["voyage"], [], ["chill"], ["voyage", "nature"], []];

/** Posts du Flow : de quoi remplir plusieurs pages avant que le Flow ne reparte du début. */
const FLOW_POST_COUNT = 40;

const FLOW_POSTS: ScenarioPost[] = Array.from({ length: FLOW_POST_COUNT }, (_, n) => ({
  key: `f${n}`,
  author: FLOW_AUTHORS[n % FLOW_AUTHORS.length],
  location: FLOW_PLACES[(n * 3) % FLOW_PLACES.length],
  ago: (n + 5) * 7 * MIN,
  art: FLOW_ARTS[(n * 7) % FLOW_ARTS.length],
  caption: FLOW_CAPTIONS[(n * 5) % FLOW_CAPTIONS.length],
  likes: 120 + ((n * 389) % 4800),
  tags: FLOW_TAGS[n % FLOW_TAGS.length],
}));

const ALL_POSTS = [...CIRCLE_POSTS, ...REELS, ...FLOW_POSTS];

/** Ids des posts de la maquette : c1…c4 (Mon cercle), r1…r4 (Reels), f0…f39 (Flow). */
export const POSTS = Object.fromEntries(ALL_POSTS.map((post, i) => [post.key, id("64b0", i + 1)])) as Record<string, string>;

const INSTANTS: { author: keyof typeof USERS; art: Art; text: string; ago: number }[] = [
  { author: "lina", art: "sunset", text: "Coucher de soleil. Je ne l'ai pas regardé, je l'ai filmé.", ago: 2 * HOUR },
  { author: "karim", art: "ring", text: "14 jours de série. Je ne sens plus mon pouce.", ago: 40 * MIN },
  { author: "ines", art: "dome", text: "Pause déj = pause scroll. Ou l'inverse.", ago: 3 * HOUR },
];

export const SHOP_ITEMS: { slug: string; name: string; description: string; icon: string; price: number; kind: ShopItemKind }[] = [
  { slug: "sucre", name: "Sachet de sucre", description: "Un petit coup de sucre, livré à ta porte.", icon: "sugar", price: 150, kind: "order" },
  { slug: "ticket", name: "Ticket à gratter", description: "Gagne ou perds des points, au hasard.", icon: "ticket", price: 300, kind: "scratch" },
  { slug: "lootbox", name: "Loot box", description: "Un objet ou un bonus tiré au sort.", icon: "box", price: 600, kind: "lootbox" },
  { slug: "cigarettes", name: "Paquet de cigarettes", description: "Le grand classique, livré sous pli discret.", icon: "cigarette", price: 1000, kind: "order" },
];

/** Crée ou met à jour les articles de L'Épicerie. */
export async function seedShop(db: Db) {
  for (const item of SHOP_ITEMS) {
    await db.shopItem.upsert({ where: { slug: item.slug }, create: item, update: item });
  }
}

/** Supprime les comptes de la maquette (et tout ce qui en dépend), puis les recrée. */
export async function seedScenario(db: Db, now = new Date()) {
  const at = (ago: number) => new Date(now.getTime() - ago);
  const old = await db.user.findMany({ where: { email: { endsWith: `@${SCENARIO_EMAIL_DOMAIN}` } }, select: { id: true } });
  await purge(db, "User", old.map((user) => user.id));

  const passwordHash = hashPassword(SCENARIO_PASSWORD);
  const today = parisDay(now);
  const yesterday = parisDay(at(DAY));
  const users: Prisma.UserCreateManyInput[] = [
    {
      id: USERS.alex,
      email: `alex@${SCENARIO_EMAIL_DOMAIN}`,
      username: "alex.detox",
      displayName: "Alex",
      bio: "Jour 6 de ma détox numérique. Je n'ai pas fermé l'appli depuis.",
      passwordHash,
      points: 2455,
      totalEarned: 2455,
      // 6e jour de série à la prochaine connexion.
      streak: { current: 5, best: 5, lastLoginDay: yesterday },
      createdAt: at(6 * DAY),
    },
    ...FRIENDS.map((friend) => {
      const totalEarned = Math.max((friend.level - 1) * 250, friend.points);
      return {
        id: USERS[friend.key as keyof typeof USERS],
        email: `${friend.key}@${SCENARIO_EMAIL_DOMAIN}`,
        username: friend.username,
        displayName: friend.name,
        bio: friend.bio,
        passwordHash,
        shielded: Boolean(friend.shielded),
        bot: true,
        points: friend.points,
        totalEarned,
        streak: { current: friend.streak, best: friend.streak, lastLoginDay: today },
        lastActiveAt: at(friend.lastActiveAgo),
        createdAt: at(30 * DAY),
      };
    }),
  ];
  await db.user.createMany({ data: users });

  const event = (userId: string, amount: number, type: Prisma.PointEventCreateManyInput["type"], label: string, when: Date) => ({
    userId, amount, type, label, day: parisDay(when), createdAt: when,
  });
  await db.pointEvent.createMany({
    data: [
      event(USERS.alex, 500, "welcome", "Cadeau de bienvenue", at(6 * DAY)),
      event(USERS.alex, 1955, "bonus", "Points des jours précédents", at(DAY)),
      // Points (et niveau) des amis : un seul gain, des jours précédents.
      ...users.slice(1).map((user) => event(user.id!, user.totalEarned!, "bonus", "Points des jours précédents", at(DAY + HOUR))),
    ],
  });

  const friendIds = FRIENDS.map((friend) => USERS[friend.key as keyof typeof USERS]);
  await db.follow.createMany({
    data: [
      ...["lina", "karim", "ines", "noah"].map((key) => ({ followerId: USERS.alex, followingId: USERS[key as keyof typeof USERS] })),
      ...friendIds.flatMap((followerId) =>
        friendIds.filter((other) => other !== followerId).map((followingId) => ({ followerId, followingId })),
      ),
    ],
  });

  await db.post.createMany({
    data: ALL_POSTS.map((post) => ({
      id: POSTS[post.key],
      authorId: USERS[post.author],
      type: post.reel ? "reel" : "photo",
      art: post.art,
      caption: post.caption,
      location: post.location,
      tags: post.tags ?? [],
      baseLikes: post.likes,
      commentsCount: post.comments?.length ?? 0,
      createdAt: at(post.ago),
    })),
  });
  await db.comment.createMany({
    data: ALL_POSTS.flatMap((post) =>
      (post.comments ?? []).map((comment) => ({
        postId: POSTS[post.key],
        authorId: USERS[comment.author],
        text: comment.text,
        createdAt: at(post.ago - 30_000),
      })),
    ),
  });

  await db.story.createMany({
    data: INSTANTS.map((instant) => ({
      authorId: USERS[instant.author],
      art: instant.art,
      text: instant.text,
      createdAt: at(instant.ago),
      expiresAt: new Date(at(instant.ago).getTime() + DAY),
    })),
  });
  return { users: users.length, posts: ALL_POSTS.length };
}
