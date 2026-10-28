import { db } from "./client";
import { NotFoundError } from "./errors";
import { type Id, toId } from "./ids";
import { parisDay } from "./time";

// Activité de l'utilisateur : dernière activité, temps passé, combo, posts vus.
// Chaque fonction fait une seule mise à jour atomique (pipeline), donc deux
// requêtes simultanées ne perdent rien. Prisma n'a pas de mise à jour par
// pipeline : on passe par une commande findAndModify brute (Extended JSON).
// Les seuils restent à régler en test.

/** Au-delà de cette pause, le temps n'est pas compté (app fermée, onglet oublié). */
export const IDLE_GAP_MS = 2 * 60 * 1000;
/** Au-delà de cette pause entre deux actions, le combo repart de 1. */
export const COMBO_GAP_MS = 10 * 1000;
/** Un coffre tous les N posts vus : « Encore N posts avant ton coffre ». */
export const CHEST_EVERY = 50;
/** Sérénité perdue par page de Flow lue dans la journée (sur 100). */
export const SERENITY_LOSS_PER_PAGE = 5;

type UserCounters = { combo?: { count: number }; postsSeen?: number; postsSeenToday?: { count: number } };

const date = (d: Date) => ({ $date: d.toISOString() });

async function updateUser(userId: Id, pipeline: object[]) {
  const res = (await db.$runCommandRaw({
    findAndModify: "users",
    query: { _id: { $oid: toId(userId, "Utilisateur") } },
    update: pipeline,
    new: true,
    fields: { combo: 1, postsSeen: 1, postsSeenToday: 1 },
  })) as { value: UserCounters | null };
  if (!res.value) throw new NotFoundError("Utilisateur");
  return res.value;
}

/**
 * À appeler à chaque requête authentifiée : met à jour « Dernière connexion »
 * (compétence 1, « En ligne ») et ajoute l'écart depuis la requête précédente
 * au temps passé, s'il est sous IDLE_GAP_MS.
 */
export async function recordActivity(userId: Id, now = new Date()) {
  const gap = { $subtract: [date(now), { $ifNull: ["$lastActiveAt", date(now)] }] };
  const counted = { $cond: [{ $and: [{ $gt: [gap, 0] }, { $lt: [gap, IDLE_GAP_MS] }] }, gap, 0] };
  await updateUser(userId, [
    { $set: { timeSpentSec: { $add: [{ $ifNull: ["$timeSpentSec", 0] }, { $divide: [counted, 1000] }] }, lastActiveAt: date(now) } },
  ]);
}

/** Enregistre une action qui rapporte des points et renvoie la longueur du combo en cours. */
export async function bumpCombo(userId: Id, now = new Date()) {
  const chained = { $lte: [{ $subtract: [date(now), { $ifNull: ["$combo.lastActionAt", date(new Date(0))] }] }, COMBO_GAP_MS] };
  const user = await updateUser(userId, [
    { $set: { combo: { count: { $cond: [chained, { $add: [{ $ifNull: ["$combo.count", 0] }, 1] }, 1] }, lastActionAt: date(now) } } },
  ]);
  return user.combo!.count;
}

/** Ajoute `count` posts vus (total et jour en cours) ; renvoie les compteurs du Flow. */
export async function recordPostsSeen(userId: Id, count: number, now = new Date()) {
  const day = parisDay(now);
  const sameDay = { $eq: ["$postsSeenToday.day", day] };
  const user = await updateUser(userId, [
    {
      $set: {
        postsSeen: { $add: [{ $ifNull: ["$postsSeen", 0] }, count] },
        postsSeenToday: { day, count: { $cond: [sameDay, { $add: ["$postsSeenToday.count", count] }, count] } },
      },
    },
  ]);
  const total = user.postsSeen!;
  return { total, today: user.postsSeenToday!.count, untilChest: postsUntilChest(total) };
}

export function postsUntilChest(postsSeen: number) {
  return CHEST_EVERY - (postsSeen % CHEST_EVERY);
}

/** Pages de Flow lues aujourd'hui : compétence « Temps de scroll » et Sérénité. */
export function flowPagesToday(userId: Id, now = new Date()) {
  return db.pointEvent.count({ where: { userId: toId(userId, "Utilisateur"), type: "flow_page", day: parisDay(now) } });
}

/** Jauge de calme sur 100, qui baisse à chaque page de Flow lue dans la journée. */
export function serenityFor(flowPages: number) {
  return Math.max(0, 100 - flowPages * SERENITY_LOSS_PER_PAGE);
}
