// L'Épicerie et la Clairvoyance côté serveur : débits, tirages, commandes fictives.
import { LOOT_PRIZES, drawTicketCells, fakeTracking, ticketWinnings } from "../game";
import { FAKE_ADDRESSES, INTEL, SHOP_ITEMS } from "./seed";
import type {
  IntelKey,
  Order,
  PointEvent,
  Purchase,
  ShopItemId,
  SkillId,
  Ticket,
  TicketView,
  TrackingStep,
} from "../types";
import { accountOf, db, eventsOf, followingOf, formatAgo, uid } from "./db";
import { ApiError } from "./http";
import { credit, debit } from "./points";

export function findShopItem(itemId: string) {
  const item = SHOP_ITEMS.find((shopItem) => shopItem.id === itemId);
  if (!item) throw new ApiError("NOT_FOUND", "Article introuvable.");
  return item;
}

function createOrder(userId: string, itemId: ShopItemId): Order {
  const item = findShopItem(itemId);
  const order: Order = {
    id: uid(),
    itemId,
    itemName: item.name,
    price: item.price,
    tracking: fakeTracking(),
    address: FAKE_ADDRESSES[Math.floor(Math.random() * FAKE_ADDRESSES.length)],
    at: Date.now(),
  };
  const orders = db().orders;
  orders.set(userId, [order, ...(orders.get(userId) ?? [])]);
  return order;
}

function drawTicket(userId: string): Ticket {
  const cells = drawTicketCells();
  const ticket: Ticket = { cells, revealed: cells.map(() => false), paidOut: false };
  db().tickets.set(userId, ticket);
  return ticket;
}

// Libellé de débit de tout achat à L'Épicerie : « Derniers achats » s'en sert pour retrouver tickets et loot box.
const PURCHASE_LABEL = "Achat : ";

export function buy(userId: string, itemId: string): { purchase: Purchase; gains: PointEvent[] } {
  const item = findShopItem(itemId);
  debit(userId, item.price, `${PURCHASE_LABEL}${item.name}`);
  if (item.kind === "ticket") {
    return { purchase: { kind: "ticket", ticket: ticketView(drawTicket(userId)) }, gains: [] };
  }
  if (item.kind === "lootbox") {
    const prize = LOOT_PRIZES[Math.floor(Math.random() * LOOT_PRIZES.length)];
    const gains = prize.points ? [credit(userId, prize.points, "Loot box")] : [];
    if (prize.item === "sucre") createOrder(userId, "sucre");
    if (prize.item === "ticket") drawTicket(userId);
    return { purchase: { kind: "lootbox", prize: prize.label }, gains };
  }
  return { purchase: { kind: "order", order: createOrder(userId, item.id) }, gains: [] };
}

// Seules les commandes du compte connecté sont cherchées : celle d'un autre compte répond 404, comme une absente.
export function findOrder(userId: string, orderId: string): Order {
  const order = db().orders.get(userId)?.find((candidate) => candidate.id === orderId);
  if (!order) throw new ApiError("NOT_FOUND", "Commande introuvable.");
  return order;
}

// Faux suivi : les étapes se valident avec le temps écoulé depuis l'achat, sauf la livraison, jamais atteinte.
export const TRACKING_STEPS = [
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

// Les cases non grattées ne quittent jamais le serveur.
export const ticketView = (ticket: Ticket): TicketView => ({
  cells: ticket.cells.map((value, index) => (ticket.revealed[index] ? value : null)),
  revealed: ticket.revealed,
  paidOut: ticket.paidOut,
  winnings: ticket.paidOut ? ticketWinnings(ticket) : null,
});

export function scratch(userId: string, index: number): { ticket: TicketView; gains: PointEvent[] } {
  const ticket = db().tickets.get(userId);
  if (!ticket) throw new ApiError("NOT_FOUND", "Aucun ticket en cours.");
  if (!Number.isInteger(index) || index < 0 || index >= ticket.cells.length) {
    throw new ApiError("INVALID_INPUT", `index doit être un entier entre 0 et ${ticket.cells.length - 1}.`);
  }
  const gains: PointEvent[] = [];
  if (!ticket.revealed[index]) {
    ticket.revealed = ticket.revealed.map((value, i) => value || i === index);
    if (ticket.revealed.every(Boolean) && !ticket.paidOut) {
      ticket.paidOut = true;
      const win = ticketWinnings(ticket);
      if (win > 0) gains.push(credit(userId, win, "Ticket gagnant"));
    }
  }
  return { ticket: ticketView(ticket), gains };
}

// ---------- Clairvoyance ----------

// Appelée à chaque ouverture d'un profil (GET /api/users/[username]) ; regarder son propre profil ne compte pas.
export function recordProfileView(viewerId: string, profileId: string) {
  if (viewerId === profileId) return;
  const views = db().profileViews;
  const counts = views.get(viewerId) ?? new Map<string, number>();
  counts.set(profileId, (counts.get(profileId) ?? 0) + 1);
  views.set(viewerId, counts);
}

// Compétence « Visites de profil » : le profil que la cible est allée voir le plus souvent.
function mostVisited(targetId: string): string {
  const [profileId, count] = [...(db().profileViews.get(targetId) ?? [])].sort((a, b) => b[1] - a[1])[0] ?? [];
  const profile = profileId ? db().users.get(profileId) : undefined;
  if (!profile || !count) return "N'a visité personne";
  return `A visité ${profile.name} ${count} fois`;
}

// Comptes seedés : fiches de la maquette. Vrais comptes : métadonnées calculées, jamais de contenu.
function intelFor(targetId: string): Record<IntelKey, string> {
  if (INTEL[targetId]) return INTEL[targetId];
  const account = accountOf(targetId);
  // Tous les achats (commandes, tickets, loot box) laissent un débit « Achat : … », du plus récent au plus ancien.
  const purchases = eventsOf(targetId)
    .filter((event) => event.label.startsWith(PURCHASE_LABEL))
    .map((event) => event.label.slice(PURCHASE_LABEL.length));
  const hours = new Map<number, number>();
  eventsOf(targetId).forEach((event) => {
    const hour = new Date(event.at).getHours();
    hours.set(hour, (hours.get(hour) ?? 0) + 1);
  });
  const peak = [...hours].sort((a, b) => b[1] - a[1])[0]?.[0];
  const circle = followingOf(targetId).size;
  return {
    "derniere-connexion": formatAgo(account.lastSeenAt),
    solde: account.points.toLocaleString("fr-FR"),
    serie: `${account.streak} jour${account.streak > 1 ? "s" : ""}`,
    "temps-scroll": `${account.flowPagesRead.length} pages`,
    "derniers-achats": purchases.length ? purchases.slice(0, 3).join(", ") : "Aucun",
    "visites-profil": mostVisited(targetId),
    "plus-gros-gain": `+${account.bestGain.toLocaleString("fr-FR")}`,
    "heures-pointe": peak === undefined ? "Pas encore assez de données" : `${peak} h – ${(peak + 1) % 24} h`,
    "cercle-proche": `${circle} compte${circle > 1 ? "s" : ""}`,
  };
}

export function assertTarget(userId: string, targetId: string) {
  const target = db().users.get(targetId);
  if (!target || targetId === userId) throw new ApiError("NOT_FOUND", "Cible introuvable.");
  if (target.shielded) throw new ApiError("TARGET_SHIELDED", "Cette cible est protégée par un bouclier.");
  return target;
}

export const ownedSkills = (userId: string, targetId: string): SkillId[] =>
  db().skills.get(userId)?.[targetId] ?? [];

// Intel débloquée uniquement : la cible n'est jamais notifiée.
export function unlockedIntel(userId: string, targetId: string): Partial<Record<IntelKey, string>> {
  const intel = intelFor(targetId);
  return Object.fromEntries(
    ownedSkills(userId, targetId)
      .filter((id): id is IntelKey => id !== "dossier-complet")
      .map((id) => [id, intel[id]]),
  );
}
