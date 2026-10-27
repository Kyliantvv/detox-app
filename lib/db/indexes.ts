import { db } from "./client";

// `prisma db push` crée les index déclarés dans prisma/schema.prisma. Ceux-ci,
// Prisma ne sait pas les décrire : on les crée par commande brute.
const EXTRA_INDEXES = [
  // Une page de Flow n'est créditée qu'une fois par utilisateur.
  {
    collection: "pointevents",
    index: { key: { userId: 1, flowPage: 1 }, name: "userId_1_flowPage_1", unique: true, partialFilterExpression: { type: "flow_page" } },
  },
  // La connexion quotidienne (+25) n'est créditée qu'une fois par jour.
  {
    collection: "pointevents",
    index: { key: { userId: 1, day: 1 }, name: "daily_login_once", unique: true, partialFilterExpression: { type: "daily_login" } },
  },
  // Mongo supprime une story à `expiresAt`.
  { collection: "stories", index: { key: { expiresAt: 1 }, name: "expiresAt_1", expireAfterSeconds: 0 } },
];

// Index qui portent une règle métier : sans eux, connectDb refuse de démarrer en prod.
const REQUIRED_INDEXES: Record<string, string[]> = {
  users: ["email_1", "username_1"],
  likes: ["userId_1_postId_1"],
  reposts: ["userId_1_postId_1"],
  saves: ["userId_1_postId_1"],
  follows: ["followerId_1_followingId_1"],
  closefriends: ["ownerId_1_friendId_1"],
  blocks: ["blockerId_1_blockedId_1"],
  conversations: ["pairKey_1"],
  orders: ["trackingNumber_1"],
  skillpurchases: ["buyerId_1_targetId_1_skill_1"],
  shopitems: ["slug_1"],
  pointevents: ["userId_1_flowPage_1", "daily_login_once"],
  stories: ["expiresAt_1"],
};

/**
 * Crée les index hors schéma. N'en supprime aucun. Continue si l'un échoue
 * (ex. index manuel sur les mêmes clés avec d'autres options dans Atlas) et
 * renvoie la liste des échecs.
 */
export async function ensureIndexes() {
  const failures: { collection: string; index: string; error: string }[] = [];
  for (const { collection, index } of EXTRA_INDEXES) {
    try {
      await db.$runCommandRaw({ createIndexes: collection, indexes: [index] });
    } catch (err) {
      failures.push({ collection, index: index.name, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return failures;
}

/** Index requis absents de la base, par collection. */
export async function missingIndexes() {
  const missing: { collection: string; indexes: string[] }[] = [];
  for (const [collection, names] of Object.entries(REQUIRED_INDEXES)) {
    const present = await indexNames(collection);
    const absent = names.filter((n) => !present.has(n));
    if (absent.length) missing.push({ collection, indexes: absent });
  }
  return missing;
}

async function indexNames(collection: string) {
  try {
    const res = (await db.$runCommandRaw({ listIndexes: collection })) as { cursor: { firstBatch: { name: string }[] } };
    return new Set(res.cursor.firstBatch.map((i) => i.name));
  } catch {
    return new Set<string>(); // collection absente
  }
}
