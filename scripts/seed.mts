import { parseArgs } from "node:util";
import { db, Prisma, type ShopItemKind } from "../lib/db";
import { createRng, fakePosts, fakeUsers, SEED_EMAIL_DOMAIN, SEED_PASSWORD } from "./seed-data";

// pnpm db:seed [--users 100] [--posts 500] [--seed 42]
// Remplit L'Épicerie, puis remplace les comptes de seed (@seed.detox.local)
// et leurs posts. Les autres comptes ne sont pas touchés.

const { values } = parseArgs({
  options: {
    users: { type: "string", default: "100" },
    posts: { type: "string", default: "500" },
    seed: { type: "string", default: "42" },
  },
});

function count(name: string, raw: string) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error(`--${name} attend un entier positif, reçu « ${raw} »`);
  return n;
}
const userCount = count("users", values.users);
const postCount = count("posts", values.posts);
if (postCount > 0 && userCount === 0) throw new Error("--posts demande au moins un utilisateur");

const items: { slug: string; name: string; description: string; icon: string; price: number; kind: ShopItemKind }[] = [
  { slug: "sucre", name: "Sachet de sucre", description: "Fausse commande, fausse livraison.", icon: "sugar", price: 150, kind: "order" },
  { slug: "ticket", name: "Ticket à gratter", description: "Gagne ou perds des points, au hasard.", icon: "ticket", price: 300, kind: "scratch" },
  { slug: "lootbox", name: "Loot box", description: "Un objet ou un bonus, tiré au sort.", icon: "box", price: 600, kind: "lootbox" },
  { slug: "cigarettes", name: "Paquet de cigarettes", description: "Fausse commande, fausse livraison.", icon: "cigarette", price: 1000, kind: "order" },
];

// createMany par paquets : une seule requête de 100 000 documents dépasserait la taille d'un message Mongo.
const CHUNK = 1000;
async function inChunks<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) await insert(rows.slice(i, i + CHUNK));
}

// Supprime des documents et, avant eux, ceux qui en dépendent (`onDelete: Cascade`
// du schéma). La cascade émulée par Prisma fait une requête par document et
// relation : 47 s pour 2 000 comptes, contre moins d'une seconde ici.
// Un seul lot de `find` : jusqu'à ~500 000 ids par collection (16 Mo).
async function purge(model: string, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const oids = (list: string[]) => list.map(($oid) => ({ $oid }));
  for (const child of Prisma.dmmf.datamodel.models) {
    for (const field of child.fields) {
      if (field.type !== model || field.relationOnDelete !== "Cascade") continue;
      const res = (await db.$runCommandRaw({
        find: child.dbName ?? child.name,
        filter: { [field.relationFromFields![0]]: { $in: oids(ids) } },
        projection: { _id: 1 },
        batchSize: 1_000_000,
      })) as { cursor: { firstBatch: { _id: { $oid: string } }[] } };
      await purge(child.name, res.cursor.firstBatch.map((d) => d._id.$oid));
    }
  }
  const collection = Prisma.dmmf.datamodel.models.find((m) => m.name === model)!.dbName ?? model;
  const res = (await db.$runCommandRaw({ delete: collection, deletes: [{ q: { _id: { $in: oids(ids) } }, limit: 0 }] })) as { n: number };
  return res.n;
}

try {
  for (const item of items) {
    await db.shopItem.upsert({ where: { slug: item.slug }, create: item, update: item });
  }
  console.log(`${items.length} articles dans L'Épicerie.`);

  const seedUsers = { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } };
  // Avec leurs posts, likes, abonnements… et ce qui dépend de ces posts.
  const oldIds = (await db.user.findMany({ where: seedUsers, select: { id: true } })).map((u) => u.id);
  const removed = await purge("User", oldIds);
  if (removed) console.log(`${removed} anciens comptes de seed supprimés.`);

  const rng = createRng(count("seed", values.seed));
  const now = new Date();
  await inChunks(fakeUsers(userCount, rng, now), (data) => db.user.createMany({ data }));
  const authorIds = (await db.user.findMany({ where: seedUsers, select: { id: true } })).map((u) => u.id);
  await inChunks(fakePosts(postCount, authorIds, rng, now), (data) => db.post.createMany({ data }));

  console.log(`${userCount} utilisateurs et ${postCount} posts créés (mot de passe : ${SEED_PASSWORD}).`);
} finally {
  await db.$disconnect();
}
