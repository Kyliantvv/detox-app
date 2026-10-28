import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { db } from "../lib/db";
import { hashPassword } from "../lib/server/password";
import { purge } from "./purge";
import { SCENARIO_PASSWORD, seedScenario, seedShop, SHOP_ITEMS } from "./scenario";
import { createRng, fakeSeed, SEED_EMAIL_DOMAIN, SEED_PASSWORD } from "./seed-data";

// pnpm db:seed [--users 100] [--posts 500] [--follows 20] [--likes 10] [--seed 42]
// Remplit L'Épicerie, remplace les comptes de la maquette (@detox.test : compte
// démo alex et ses amis), puis les comptes aléatoires (@seed.detox.local), leurs
// posts, abonnements, likes et historiques de points. Les autres comptes ne sont
// pas touchés.
// Crée aussi les comptes « admin » et « user » (@detox.app) s'ils n'existent pas, sans
// jamais modifier un compte existant. Mots de passe : SEED_ADMIN_PASSWORD et
// SEED_USER_PASSWORD, sinon tirés au hasard et affichés une seule fois.

const { values } = parseArgs({
  options: {
    users: { type: "string", default: "100" },
    posts: { type: "string", default: "500" },
    // Moyennes : abonnements par utilisateur, likes par post.
    follows: { type: "string", default: "20" },
    likes: { type: "string", default: "10" },
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

// createMany par paquets : une seule requête de 100 000 documents dépasserait la taille d'un message Mongo.
const CHUNK = 1000;
async function inChunks<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) await insert(rows.slice(i, i + CHUNK));
}

const ACCOUNTS = [
  { username: "admin", email: "admin@detox.app", role: "admin", env: "SEED_ADMIN_PASSWORD" },
  { username: "user", email: "user@detox.app", role: "user", env: "SEED_USER_PASSWORD" },
] as const;

async function seedAccounts() {
  for (const { username, email, role, env } of ACCOUNTS) {
    if (await db.user.findUnique({ where: { email } })) {
      console.log(`Compte ${email} déjà présent, laissé tel quel.`);
      continue;
    }
    const password = process.env[env] || randomBytes(9).toString("base64url");
    await db.user.create({
      data: { email, username, role, displayName: username, passwordHash: hashPassword(password), lastActiveAt: new Date() },
    });
    console.log(`Compte ${email} (${role}) créé. Mot de passe : ${process.env[env] ? `défini par ${env}` : password}.`);
  }
}

try {
  await seedShop(db);
  console.log(`${SHOP_ITEMS.length} articles dans L'Épicerie.`);

  const scenario = await seedScenario(db);
  console.log(
    `Maquette : ${scenario.users} comptes (dont alex@detox.test) et ${scenario.posts} posts. Mot de passe : ${SCENARIO_PASSWORD}.`,
  );

  await seedAccounts();

  const seedUsers = { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } };
  // Avec leurs posts, likes, abonnements… et ce qui dépend de ces posts.
  const oldIds = (await db.user.findMany({ where: seedUsers, select: { id: true } })).map((u) => u.id);
  const removed = await purge(db, "User", oldIds);
  if (removed) console.log(`${removed} anciens comptes de seed supprimés.`);

  const data = fakeSeed(
    { users: userCount, posts: postCount, followsPerUser: count("follows", values.follows), likesPerPost: count("likes", values.likes) },
    createRng(count("seed", values.seed)),
  );
  // Ni points ni compteurs écrits à la main : `fakeSeed` les calcule à partir des likes et du journal de points.
  await inChunks(data.users, (rows) => db.user.createMany({ data: rows }));
  await inChunks(data.posts, (rows) => db.post.createMany({ data: rows }));
  await inChunks(data.follows, (rows) => db.follow.createMany({ data: rows }));
  await inChunks(data.likes, (rows) => db.like.createMany({ data: rows }));
  await inChunks(data.pointEvents, (rows) => db.pointEvent.createMany({ data: rows }));

  const points = data.users.reduce((sum, u) => sum + (u.points ?? 0), 0);
  console.log(
    `${data.users.length} utilisateurs, ${data.posts.length} posts, ${data.follows.length} abonnements, ${data.likes.length} likes ` +
      `et ${points} points (${data.pointEvents.length} gains) créés. Mot de passe : ${SEED_PASSWORD}.`,
  );
} finally {
  await db.$disconnect();
}
