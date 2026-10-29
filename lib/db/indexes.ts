import { db } from "./client";

// `prisma db push` crée les index déclarés dans prisma/schema.prisma. Ceux-ci,
// Prisma ne sait pas les décrire : on les crée par commande brute.
const EXTRA_INDEXES = [
  // Une page de Flow n'est créditée qu'une fois par utilisateur.
  {
    collection: "point_events",
    index: { key: { userId: 1, flowPage: 1 }, name: "point_events_flow_page_once", unique: true, partialFilterExpression: { type: "flow_page" } },
  },
  // La connexion quotidienne (+25) n'est créditée qu'une fois par jour.
  {
    collection: "point_events",
    index: { key: { userId: 1, day: 1 }, name: "point_events_daily_login_once", unique: true, partialFilterExpression: { type: "daily_login" } },
  },
  // Mongo supprime une story à `expiresAt`.
  { collection: "stories", index: { key: { expiresAt: 1 }, name: "stories_expiresAt_ttl", expireAfterSeconds: 0 } },
];

// Les @unique / @@unique du schéma, sous le nom que leur donne Prisma.
const uniqueIndex = (collection: string, ...fields: string[]) => [collection, `${collection}_${fields.join("_")}_key`];

// Index qui portent une règle métier : sans eux, connectDb refuse de démarrer en prod.
// Le test d'intégration vérifie que `pnpm db:indexes` les crée tous.
const REQUIRED_INDEXES = [
  uniqueIndex("users", "email"),
  uniqueIndex("users", "username"),
  uniqueIndex("likes", "userId", "postId"),
  uniqueIndex("reposts", "userId", "postId"),
  uniqueIndex("saves", "userId", "postId"),
  uniqueIndex("follows", "followerId", "followingId"),
  uniqueIndex("close_friends", "ownerId", "friendId"),
  uniqueIndex("blocks", "blockerId", "blockedId"),
  uniqueIndex("conversations", "pairKey"),
  uniqueIndex("orders", "trackingNumber"),
  uniqueIndex("skill_purchases", "buyerId", "targetId", "skill"),
  uniqueIndex("shop_items", "slug"),
  uniqueIndex("flow_pages", "userId", "page"),
  uniqueIndex("media", "key"),
  ...EXTRA_INDEXES.map(({ collection, index }) => [collection, index.name]),
];

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
  const byCollection = Map.groupBy(REQUIRED_INDEXES, ([collection]) => collection);
  const missing: { collection: string; indexes: string[] }[] = [];
  for (const [collection, required] of byCollection) {
    const present = await indexNames(collection);
    const absent = required.map(([, name]) => name).filter((name) => !present.has(name));
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
