import { connectDb, db, missingIndexes } from "../lib/db";
import { verifyPassword } from "../lib/server/password";
import { SCENARIO_EMAIL_DOMAIN, SCENARIO_PASSWORD, SHOP_ITEMS } from "./scenario";
import { SEED_EMAIL_DOMAIN } from "./seed-data";

// pnpm db:smoke : vérifie, en lecture seule, qu'une base est prête à servir l'app
// (index requis, boutique, compte démo, données de démo). Code de sortie 1 sinon.
// Lancé par la CI après `pnpm db:seed`, sur la base de test puis sur la prod.

const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  if (!ok) failures.push(message);
};

try {
  await connectDb();
  const missing = await missingIndexes();
  check(missing.length === 0, `index manquants : ${missing.map((m) => `${m.collection} (${m.indexes.join(", ")})`).join(" ; ")}`);

  const slugs = (await db.shopItem.findMany({ where: { active: true }, select: { slug: true } })).map((item) => item.slug);
  check(SHOP_ITEMS.every((item) => slugs.includes(item.slug)), `boutique incomplète : ${slugs.join(", ") || "vide"}`);

  const demo = await db.user.findUnique({ where: { email: `alex@${SCENARIO_EMAIL_DOMAIN}` }, omit: { passwordHash: false } });
  check(Boolean(demo && verifyPassword(SCENARIO_PASSWORD, demo.passwordHash)), "compte démo absent ou mot de passe différent");

  const counts = {
    scenarioUsers: await db.user.count({ where: { email: { endsWith: `@${SCENARIO_EMAIL_DOMAIN}` } } }),
    seedUsers: await db.user.count({ where: { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } } }),
    posts: await db.post.count(),
    stories: await db.story.count({ where: { expiresAt: { gt: new Date() } } }),
  };
  console.log(JSON.stringify(counts));
  check(counts.scenarioUsers === 6, `comptes de la maquette : ${counts.scenarioUsers} au lieu de 6`);
  check(counts.posts > 0, "aucun post");
  check(counts.stories > 0, "aucun Instant en cours");
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
} finally {
  await db.$disconnect();
}

for (const failure of failures) console.error(`Échec : ${failure}`);
if (failures.length) process.exitCode = 1;
else console.log("Base prête.");
