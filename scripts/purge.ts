import { Prisma } from "@prisma/client";
import type { Db } from "../lib/db/client";

// Supprime des documents et, avant eux, ceux qui en dépendent (`onDelete: Cascade`
// du schéma). La cascade émulée par Prisma fait une requête par document et
// relation : 47 s pour 2 000 comptes, contre moins d'une seconde ici.
// Un seul lot de `find` : jusqu'à ~500 000 ids par collection (16 Mo).
export async function purge(db: Db, model: string, ids: string[]): Promise<number> {
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
      await purge(db, child.name, res.cursor.firstBatch.map((d) => d._id.$oid));
    }
  }
  const collection = Prisma.dmmf.datamodel.models.find((m) => m.name === model)!.dbName ?? model;
  const res = (await db.$runCommandRaw({ delete: collection, deletes: [{ q: { _id: { $in: oids(ids) } }, limit: 0 }] })) as { n: number };
  return res.n;
}
