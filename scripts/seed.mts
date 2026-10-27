import { db, type ShopItemKind } from "../lib/db";

const items: { slug: string; name: string; description: string; icon: string; price: number; kind: ShopItemKind }[] = [
  { slug: "sucre", name: "Sachet de sucre", description: "Fausse commande, fausse livraison.", icon: "sugar", price: 150, kind: "order" },
  { slug: "ticket", name: "Ticket à gratter", description: "Gagne ou perds des points, au hasard.", icon: "ticket", price: 300, kind: "scratch" },
  { slug: "lootbox", name: "Loot box", description: "Un objet ou un bonus, tiré au sort.", icon: "box", price: 600, kind: "lootbox" },
  { slug: "cigarettes", name: "Paquet de cigarettes", description: "Fausse commande, fausse livraison.", icon: "cigarette", price: 1000, kind: "order" },
];

try {
  for (const item of items) {
    await db.shopItem.upsert({ where: { slug: item.slug }, create: item, update: item });
  }
  console.log(`${items.length} articles dans L'Épicerie.`);
} finally {
  await db.$disconnect();
}
