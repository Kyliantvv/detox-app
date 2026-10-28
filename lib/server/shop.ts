// L'Épicerie et la Clairvoyance côté serveur : débits, tirages, commandes fictives.
// Chaque achat débite et crée son document dans la même transaction (voir docs/db/README.md).
import { LOOT_PRIZES, drawTicketCells, fakeTracking, ticketWinnings } from "../game";
import type {
  IntelKey,
  Order,
  PointEvent,
  Purchase,
  ShopItem,
  ShopItemId,
  SkillId,
  TicketView,
  TrackingStep,
} from "../types";
import {
  buySkill,
  db,
  flowPagesToday,
  InsufficientPointsError,
  inTransaction,
  isDuplicateKey,
  SKILLS,
  toId,
  type Draw,
  type Order as DbOrder,
  type ShopItem as DbShopItem,
  type Tx,
} from "../db";
import { FAKE_ADDRESSES, SKILL_CATALOG, skillById } from "./content";
import { formatAgo, hourInParis } from "./format";
import { ApiError } from "./http";
import { credit, debit, pointEvent } from "./points";
import { displayName } from "./views";

// ---------- Articles ----------

export const shopItemView = (item: DbShopItem): ShopItem => ({
  id: item.slug as ShopItemId,
  name: item.name,
  price: item.price,
  description: item.description,
  kind: item.kind === "scratch" ? "ticket" : item.kind,
});

export const listShopItems = () => db.shopItem.findMany({ where: { active: true }, orderBy: { price: "asc" } });

async function findShopItem(slug: string, tx: Tx | typeof db = db) {
  const item = await tx.shopItem.findFirst({ where: { slug, active: true } });
  if (!item) throw new ApiError("NOT_FOUND", "Article introuvable.");
  return item;
}

// ---------- Commandes ----------

type OrderWithItem = DbOrder & { item: Pick<DbShopItem, "slug"> };

export const orderView = (order: OrderWithItem): Order => ({
  id: order.id,
  itemId: order.item.slug as ShopItemId,
  itemName: order.itemSnapshot.name,
  price: order.itemSnapshot.price,
  tracking: order.trackingNumber,
  address: order.fakeAddress,
  at: order.createdAt.getTime(),
});

function createOrder(tx: Tx, userId: string, item: DbShopItem) {
  return tx.order.create({
    data: {
      userId,
      itemId: item.id,
      itemSnapshot: { name: item.name, price: item.price },
      fakeAddress: FAKE_ADDRESSES[Math.floor(Math.random() * FAKE_ADDRESSES.length)],
      trackingNumber: fakeTracking(),
      createdAt: new Date(),
    },
    include: { item: { select: { slug: true } } },
  });
}

export const listOrders = (userId: string) =>
  db.order.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { item: { select: { slug: true } } } });

// Seules les commandes du compte connecté sont cherchées : celle d'un autre compte répond 404, comme une absente.
export async function findOrder(userId: string, orderId: string) {
  const order = await db.order.findFirst({
    where: { id: toId(orderId, "Commande"), userId },
    include: { item: { select: { slug: true } } },
  });
  if (!order) throw new ApiError("NOT_FOUND", "Commande introuvable.");
  return orderView(order);
}

// Suivi : les étapes se valident avec le temps écoulé depuis l'achat, sauf la livraison, qui n'a pas de date.
const TRACKING_STEPS = [
  { label: "Commande validée", afterMs: 0 },
  { label: "Colis préparé", afterMs: 2 * 60_000 },
  { label: "Remis au transporteur", afterMs: 10 * 60_000 },
  { label: "En transit", afterMs: 30 * 60_000 },
];

export function trackingSteps(order: Order, now = Date.now()): TrackingStep[] {
  return [
    ...TRACKING_STEPS.map(({ label, afterMs }) => ({ label, at: order.at + afterMs, done: now >= order.at + afterMs })),
    { label: "Livré", at: null, done: false },
  ];
}

// ---------- Tickets à gratter (Draw `scratch`) ----------

// Les cases non grattées ne quittent jamais le serveur.
export function ticketView(draw: Draw): TicketView {
  const paidOut = draw.status === "done";
  return {
    cells: draw.cells.map((cell) => (cell.revealed ? cell.value : null)),
    revealed: draw.cells.map((cell) => cell.revealed),
    paidOut,
    winnings: paidOut ? draw.payout : null,
  };
}

// Le tirage est fait à la création : le client ne fait que révéler.
function drawTicket(tx: Tx, userId: string, cost: number) {
  const values = drawTicketCells();
  return tx.draw.create({
    data: {
      userId,
      kind: "scratch",
      cost,
      cells: values.map((value) => ({ value, revealed: false })),
      payout: ticketWinnings({ cells: values }),
      createdAt: new Date(),
    },
  });
}

// Ticket en cours : le dernier acheté, gratté ou non.
export const currentTicket = (userId: string) =>
  db.draw.findFirst({ where: { userId, kind: "scratch" }, orderBy: { createdAt: "desc" } });

export async function scratch(userId: string, index: number): Promise<{ ticket: TicketView; gains: PointEvent[] }> {
  return inTransaction(undefined, async (tx) => {
    const draw = await tx.draw.findFirst({ where: { userId, kind: "scratch" }, orderBy: { createdAt: "desc" } });
    if (!draw) throw new ApiError("NOT_FOUND", "Aucun ticket en cours.");
    if (!Number.isInteger(index) || index < 0 || index >= draw.cells.length) {
      throw new ApiError("INVALID_INPUT", `index doit être un entier entre 0 et ${draw.cells.length - 1}.`);
    }
    if (draw.cells[index].revealed) return { ticket: ticketView(draw), gains: [] };
    const cells = draw.cells.map((cell, i) => ({ value: cell.value, revealed: cell.revealed || i === index }));
    const finished = cells.every((cell) => cell.revealed) && draw.status === "open";
    const updated = await tx.draw.update({
      where: { id: draw.id },
      data: { cells: { set: cells }, ...(finished ? { status: "done" } : {}) },
    });
    const gains = finished
      ? await credit(userId, draw.payout, "draw_payout", "Ticket gagnant", { refId: draw.id, tx })
      : [];
    return { ticket: ticketView(updated), gains };
  });
}

// ---------- Achat ----------

export async function buy(userId: string, slug: string): Promise<{ purchase: Purchase; gains: PointEvent[] }> {
  return inTransaction(undefined, async (tx) => {
    const item = await findShopItem(slug, tx);
    const label = `Achat : ${item.name}`;
    if (item.kind === "scratch") {
      const draw = await drawTicket(tx, userId, item.price);
      await debit(userId, item.price, "draw_cost", label, { refId: draw.id, tx });
      return { purchase: { kind: "ticket", ticket: ticketView(draw) }, gains: [] };
    }
    if (item.kind === "lootbox") {
      const prize = LOOT_PRIZES[Math.floor(Math.random() * LOOT_PRIZES.length)];
      const prizeItem = prize.item ? await findShopItem(prize.item, tx) : undefined;
      const box = await tx.draw.create({
        data: {
          userId,
          kind: "lootbox",
          cost: item.price,
          payout: prize.points ?? 0,
          prizeItemId: prizeItem?.id,
          status: "done",
          createdAt: new Date(),
        },
      });
      await debit(userId, item.price, "draw_cost", label, { refId: box.id, tx });
      const gains = await credit(userId, prize.points ?? 0, "draw_payout", "Loot box", { refId: box.id, tx });
      if (prizeItem?.kind === "order") await createOrder(tx, userId, prizeItem);
      if (prizeItem?.kind === "scratch") await drawTicket(tx, userId, 0);
      return { purchase: { kind: "lootbox", prize: prize.label }, gains };
    }
    const order = await createOrder(tx, userId, item);
    await debit(userId, item.price, "shop_purchase", label, { refId: order.id, tx });
    return { purchase: { kind: "order", order: orderView(order) }, gains: [] };
  });
}

// ---------- Clairvoyance ----------

// Appelée à chaque ouverture d'un profil (GET /api/users/[username]) ; regarder son propre profil ne compte pas.
export async function recordProfileView(viewerId: string, profileId: string) {
  if (viewerId === profileId) return;
  await db.profileView.create({ data: { viewerId, profileId, createdAt: new Date() } });
}

// Compétence « Visites de profil » : le profil que la cible est allée voir le plus souvent.
async function mostVisited(targetId: string) {
  const visits = await db.profileView.groupBy({ by: ["profileId"], where: { viewerId: targetId }, _count: { _all: true } });
  const [top] = visits.sort((a, b) => b._count._all - a._count._all);
  const profile = top && (await db.user.findUnique({ where: { id: top.profileId } }));
  if (!profile) return "N'a visité personne";
  return `A visité ${displayName(profile)} ${top._count._all} fois`;
}

// Commandes, tickets et loot box, du plus récent au plus ancien.
async function recentPurchases(targetId: string) {
  const [orders, draws] = await Promise.all([
    db.order.findMany({ where: { userId: targetId }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.draw.findMany({ where: { userId: targetId, cost: { gt: 0 } }, orderBy: { createdAt: "desc" }, take: 3 }),
  ]);
  return [
    ...orders.map((order) => ({ at: order.createdAt, name: order.itemSnapshot.name })),
    ...draws.map((draw) => ({ at: draw.createdAt, name: draw.kind === "lootbox" ? "Loot box" : "Ticket à gratter" })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 3)
    .map((purchase) => purchase.name);
}

// Métadonnées calculées depuis la base, jamais le contenu des messages.
async function intelFor(targetId: string): Promise<Record<IntelKey, string>> {
  const target = await db.user.findUniqueOrThrow({ where: { id: targetId } });
  const [pages, purchases, visits, best, events, circle] = await Promise.all([
    flowPagesToday(targetId),
    recentPurchases(targetId),
    mostVisited(targetId),
    db.pointEvent.findFirst({ where: { userId: targetId, amount: { gt: 0 } }, orderBy: { amount: "desc" } }),
    db.pointEvent.findMany({ where: { userId: targetId }, orderBy: { createdAt: "desc" }, take: 500, select: { createdAt: true } }),
    db.follow.count({ where: { followerId: targetId } }),
  ]);
  const hours = new Map<number, number>();
  for (const { createdAt } of events) {
    const hour = hourInParis(createdAt);
    hours.set(hour, (hours.get(hour) ?? 0) + 1);
  }
  const peak = [...hours].sort((a, b) => b[1] - a[1])[0]?.[0];
  const streak = target.streak?.current ?? 0;
  return {
    "derniere-connexion": target.lastActiveAt ? formatAgo(target.lastActiveAt) : "Jamais",
    solde: target.points.toLocaleString("fr-FR"),
    serie: `${streak} jour${streak > 1 ? "s" : ""}`,
    "temps-scroll": `${pages} page${pages > 1 ? "s" : ""}`,
    "derniers-achats": purchases.length ? purchases.join(", ") : "Aucun",
    "visites-profil": visits,
    "plus-gros-gain": best ? `+${best.amount.toLocaleString("fr-FR")} (${best.label || best.type})` : "+0",
    "heures-pointe": peak === undefined ? "Pas encore assez de données" : `${peak} h – ${(peak + 1) % 24} h`,
    "cercle-proche": `${circle} compte${circle > 1 ? "s" : ""}`,
  };
}

export async function assertTarget(userId: string, targetId: string) {
  const target = await db.user.findUnique({ where: { id: toId(targetId, "targetId") } });
  if (!target || target.id === userId) throw new ApiError("NOT_FOUND", "Cible introuvable.");
  if (target.shielded) throw new ApiError("TARGET_SHIELDED", "Cette cible est protégée par un bouclier.");
  return target;
}

// Le Dossier complet débloque toutes les compétences.
export async function ownedSkills(userId: string, targetId: string): Promise<SkillId[]> {
  const purchases = await db.skillPurchase.findMany({ where: { buyerId: userId, targetId }, select: { skill: true } });
  const bought = new Set(purchases.map((purchase) => purchase.skill));
  if (bought.has("full_dossier")) return SKILL_CATALOG.map((skill) => skill.id);
  return SKILL_CATALOG.filter((skill) => bought.has(skill.skill)).map((skill) => skill.id);
}

// Intel débloquée uniquement : la cible n'est jamais notifiée.
export async function unlockedIntel(owned: SkillId[], targetId: string): Promise<Partial<Record<IntelKey, string>>> {
  const keys = owned.filter((id): id is IntelKey => id !== "dossier-complet");
  if (!keys.length) return {};
  const intel = await intelFor(targetId);
  return Object.fromEntries(keys.map((id) => [id, intel[id]]));
}

// Achat unique par cible, au prix de SKILLS ; déjà débloquée, la compétence ne coûte rien.
export async function buyTargetSkill(userId: string, targetId: string, skillId: string) {
  const entry = skillById(skillId);
  if (!entry) throw new ApiError("NOT_FOUND", "Compétence introuvable.");
  await assertTarget(userId, targetId);
  const events: PointEvent[] = [];
  if (!(await ownedSkills(userId, targetId)).includes(entry.id)) {
    try {
      const { event } = await buySkill(userId, targetId, entry.skill, `Clairvoyance : ${entry.name}`);
      events.push(pointEvent(event));
    } catch (error) {
      // Achat simultané de la même compétence : aucun point débité.
      if (isDuplicateKey(error)) return events;
      if (!(error instanceof InsufficientPointsError)) throw error;
      const { points } = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { points: true } });
      throw new ApiError("INSUFFICIENT_POINTS", `Il te manque ${SKILLS[entry.skill] - points} pts. Retourne scroller.`);
    }
  }
  return events;
}
