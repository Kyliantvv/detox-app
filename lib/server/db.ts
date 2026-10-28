// Base de données mockée : des Map en mémoire, seedées depuis lib/server/seed.ts.
// Gardée sur globalThis pour survivre au rechargement à chaud de `next dev`.
// Tout est perdu au redémarrage du serveur : c'est voulu, à remplacer par MongoDB.
import "server-only";
import {
  CIRCLE_POSTS,
  DEMO_USER,
  FRIENDS,
  INSTANTS,
  INTEL,
  REELS,
  STARTER_MESSAGES,
  flowPage,
} from "./seed";
import type { ArtVariant, Order, PointEvent, SkillId, Ticket } from "../types";
import { hashPassword } from "./password";

export type DbUser = {
  id: string;
  email: string;
  username: string;
  name: string;
  bio: string;
  passwordHash: string;
  status: string;
  shielded: boolean;
  // Comptes seedés : ils répondent automatiquement aux messages.
  bot: boolean;
  createdAt: number;
};

export type Account = {
  points: number;
  totalEarned: number;
  totalSpent: number;
  bestGain: number;
  streak: number;
  lastLoginDay: string | null;
  lastSeenAt: number;
  // Temps actif cumulé : écarts de moins de ACTIVE_GAP_MS entre deux requêtes authentifiées.
  timeSpentMs: number;
  serenity: number;
  flowPagesRead: number[];
  earnedToday: number;
  combo: { count: number; lastAt: number };
};

export type DbPost = {
  id: string;
  authorId: string;
  location: string;
  // Libellé figé pour les posts seedés ; sinon calculé depuis createdAt.
  ago?: string;
  createdAt: number;
  art: ArtVariant;
  caption: string;
  baseDoses: number;
  isReel: boolean;
  mediaId?: string;
};

export type DbComment = { author: string; text: string; at: number };
export type DbMessage = { id: string; senderId: string; text: string; at: number };
export type DbMedia = { type: string; bytes: Uint8Array };
export type DbInstant = { art: ArtVariant; text: string; at: number };

type Db = {
  users: Map<string, DbUser>;
  accounts: Map<string, Account>;
  posts: Map<string, DbPost>;
  comments: Map<string, DbComment[]>;
  likes: Set<string>; // `${userId}:${postId}`
  saves: Set<string>; // `${userId}:${postId}`
  follows: Map<string, Set<string>>;
  orders: Map<string, Order[]>;
  tickets: Map<string, Ticket>;
  skills: Map<string, Record<string, SkillId[]>>; // userId → cible → compétences
  messages: Map<string, DbMessage[]>; // conversationKey → messages
  reads: Map<string, number>; // `${userId}:${conversationKey}` → dernier `at` lu
  events: Map<string, PointEvent[]>;
  media: Map<string, DbMedia>;
  instants: Map<string, DbInstant>;
};

export const SEED_PASSWORD = "demo1234";
export const DEFAULT_FOLLOWING = ["lina", "karim", "ines", "noah"];
export const DEMO_ID = "alex";

export const uid = () => Math.random().toString(36).slice(2, 10);
export const today = (at = Date.now()) => new Date(at).toISOString().slice(0, 10);
const digits = (text: string) => Number(text.replace(/[^\d]/g, "")) || 0;

export function newAccount(): Account {
  return {
    points: 0,
    totalEarned: 0,
    totalSpent: 0,
    bestGain: 0,
    streak: 0,
    lastLoginDay: null,
    lastSeenAt: Date.now(),
    timeSpentMs: 0,
    serenity: 100,
    flowPagesRead: [],
    earnedToday: 0,
    combo: { count: 0, lastAt: 0 },
  };
}

function seed(): Db {
  const now = Date.now();
  const passwordHash = hashPassword(SEED_PASSWORD);
  const data: Db = {
    users: new Map(),
    accounts: new Map(),
    posts: new Map(),
    comments: new Map(),
    likes: new Set(),
    saves: new Set(),
    follows: new Map(),
    orders: new Map(),
    tickets: new Map(),
    skills: new Map(),
    messages: new Map(),
    reads: new Map(),
    events: new Map(),
    media: new Map(),
    instants: new Map(),
  };

  for (const friend of FRIENDS) {
    data.users.set(friend.id, {
      id: friend.id,
      email: `${friend.id}@detox.test`,
      username: friend.username,
      name: friend.name,
      bio: friend.status,
      passwordHash,
      status: friend.status,
      shielded: Boolean(friend.shielded),
      bot: true,
      createdAt: now,
    });
    // Le niveau affiché par la maquette est retrouvé par levelFor(totalEarned).
    const intel = INTEL[friend.id];
    const totalEarned = (friend.level - 1) * 250;
    data.accounts.set(friend.id, {
      ...newAccount(),
      totalEarned,
      points: intel ? digits(intel.solde) : totalEarned,
      streak: intel ? digits(intel.serie) : 1,
      bestGain: intel ? digits(intel["plus-gros-gain"].split("(")[0]) : 0,
    });
    data.follows.set(friend.id, new Set(FRIENDS.map((f) => f.id).filter((id) => id !== friend.id)));
  }

  for (const [userId, instant] of Object.entries(INSTANTS)) {
    data.instants.set(userId, { art: instant.art, text: instant.text, at: now - instant.agoMs });
  }

  // Compte démo : 6e jour de série au prochain login, comme loginDemo() dans le store.
  data.users.set(DEMO_ID, {
    id: DEMO_ID,
    ...DEMO_USER,
    name: "Alex",
    passwordHash,
    status: "En ligne",
    shielded: false,
    bot: false,
    createdAt: now,
  });
  data.accounts.set(DEMO_ID, {
    ...newAccount(),
    points: 2455,
    totalEarned: 2455,
    bestGain: 1955,
    streak: 5,
    lastLoginDay: today(now - 86_400_000),
  });
  data.events.set(DEMO_ID, [
    { id: uid(), amount: 1955, label: "Points des jours précédents", at: now - 86_400_000 },
    { id: uid(), amount: 500, label: "Cadeau de bienvenue", at: now - 6 * 86_400_000 },
  ]);
  data.follows.set(DEMO_ID, new Set(DEFAULT_FOLLOWING));

  [...CIRCLE_POSTS, ...REELS].forEach((post, index) => {
    data.posts.set(post.id, {
      id: post.id,
      authorId: post.authorId,
      location: post.location,
      ago: post.ago,
      createdAt: now - (index + 1) * 60_000,
      art: post.art,
      caption: post.caption,
      baseDoses: post.doses,
      isReel: Boolean(post.isReel),
    });
    data.comments.set(
      post.id,
      post.comments.map((comment) => ({ ...comment, at: now - 60_000 })),
    );
  });

  return data;
}

const globalForDb = globalThis as unknown as { __detoxDb?: Db };

export function db(): Db {
  globalForDb.__detoxDb ??= seed();
  return globalForDb.__detoxDb;
}

// ---------- Accès ----------

export const ACTIVE_GAP_MS = 5 * 60_000;
export const INSTANT_TTL_MS = 24 * 3_600_000;

// Appelé à chaque requête authentifiée : alimente « Dernière connexion » et le temps passé.
export function touch(userId: string) {
  const account = accountOf(userId);
  const now = Date.now();
  const gap = now - account.lastSeenAt;
  if (gap > 0 && gap < ACTIVE_GAP_MS) account.timeSpentMs += gap;
  account.lastSeenAt = now;
}

export function activeInstant(userId: string): DbInstant | undefined {
  const instant = db().instants.get(userId);
  return instant && Date.now() - instant.at < INSTANT_TTL_MS ? instant : undefined;
}

export function accountOf(userId: string): Account {
  const accounts = db().accounts;
  let account = accounts.get(userId);
  if (!account) {
    account = newAccount();
    accounts.set(userId, account);
  }
  return account;
}

export const userByEmail = (email: string) =>
  [...db().users.values()].find((user) => user.email === email.toLowerCase());

export const userByUsername = (username: string) =>
  [...db().users.values()].find((user) => user.username.toLowerCase() === username.toLowerCase());

export function followingOf(userId: string): Set<string> {
  const follows = db().follows;
  let set = follows.get(userId);
  if (!set) {
    set = new Set();
    follows.set(userId, set);
  }
  return set;
}

export const followersCount = (userId: string) =>
  [...db().follows.values()].filter((set) => set.has(userId)).length;

// Les posts du Flow (f0, f1…) ne sont pas stockés : ils sont régénérés depuis flowPage().
export function findPost(id: string): DbPost | undefined {
  const stored = db().posts.get(id);
  if (stored) return stored;
  const match = /^f(\d+)$/.exec(id);
  if (!match) return undefined;
  const n = Number(match[1]);
  const post = flowPage(Math.floor(n / 5))[n % 5];
  return {
    id: post.id,
    authorId: post.authorId,
    location: post.location,
    ago: post.ago,
    createdAt: 0,
    art: post.art,
    caption: post.caption,
    baseDoses: post.doses,
    isReel: false,
  };
}

export function eventsOf(userId: string): PointEvent[] {
  const events = db().events;
  let list = events.get(userId);
  if (!list) {
    list = [];
    events.set(userId, list);
  }
  return list;
}

// ---------- Messages ----------

export const conversationKey = (a: string, b: string) => [a, b].sort().join("__");

// Renvoie le fil entre deux comptes ; amorcé avec les messages de la maquette si c'est un compte seedé.
export function conversation(meId: string, otherId: string): DbMessage[] {
  const messages = db().messages;
  const key = conversationKey(meId, otherId);
  let thread = messages.get(key);
  if (!thread) {
    const starter = db().users.get(otherId)?.bot ? (STARTER_MESSAGES[otherId] ?? []) : [];
    const start = Date.now() - starter.length * 60_000;
    thread = starter.map((message, index) => ({
      id: uid(),
      senderId: message.from === "me" ? meId : otherId,
      text: message.text,
      at: start + index * 60_000,
    }));
    messages.set(key, thread);
  }
  return thread;
}

// ---------- Format ----------

export function formatAgo(at: number, now = Date.now()): string {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "hier" : `il y a ${days} j`;
}
