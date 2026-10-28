// Base des tests de routes : vidée puis remplie avec la maquette avant chaque test (test/db-setup.ts).
import { db, Prisma } from "@/lib/db";
import { POSTS, seedScenario, seedShop, USERS } from "@/scripts/scenario";

export { POSTS, USERS };

export async function resetDb() {
  for (const model of Prisma.dmmf.datamodel.models) {
    await db.$runCommandRaw({ delete: model.dbName ?? model.name, deletes: [{ q: {}, limit: 0 }] });
  }
  await seedShop(db);
  await seedScenario(db);
}

/** Compte de la maquette (alex, lina…) ou id brut, relu dans la base. */
export const userRow = (who: string) =>
  db.user.findUniqueOrThrow({ where: { id: USERS[who as keyof typeof USERS] ?? who } });

const POST_KEYS = new Map(Object.entries(POSTS).map(([key, id]) => [id, key]));
/** Clés de la maquette (c1, r2, f7…) des posts d'une réponse, pour des assertions lisibles. */
export const postKeys = (items: { id: string }[]) => items.map((item) => POST_KEYS.get(item.id) ?? item.id);
