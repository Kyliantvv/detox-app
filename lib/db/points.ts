import mongoose, { type ClientSession, type Types } from "mongoose";
import { NotFoundError } from "./errors";
import { POINT_EVENT_TYPES, PointEvent } from "./models/point-event";
import { User } from "./models/user";

type Id = Types.ObjectId | string;
type EventType = (typeof POINT_EVENT_TYPES)[number];

// Chaque mouvement de points écrit le solde et son PointEvent dans la même
// transaction : l'un ne peut pas exister sans l'autre.
//
// Sans `session`, chaque fonction ouvre sa propre transaction. Pour lier le
// mouvement à une autre écriture (achat, commande, tirage), passer la session
// de sa propre transaction : tout est validé ou annulé ensemble.
//
//   await mongoose.connection.transaction(async (session) => {
//     if (!(await spendPoints(userId, price, "skill_purchase", { session }))) throw new Error("Solde insuffisant");
//     await SkillPurchase.create([{ buyerId: userId, targetId, skill, price }], { session });
//   });

/**
 * Crédite `amount` points (0 ne fait rien, pratique pour un tirage perdant).
 * Lève NotFoundError si l'utilisateur n'existe pas.
 * Pour une page de Flow, passer `flowPage` : un second crédit de la même page
 * lève une erreur E11000 (code 11000) et rien n'est crédité.
 */
export async function creditPoints(
  userId: Id,
  amount: number,
  type: EventType,
  opts: { flowPage?: number; refId?: Id; session?: ClientSession } = {},
) {
  assertInt(amount, 0);
  if (amount === 0) return;
  const { session, ...extra } = opts;
  await inTransaction(session, async (s) => {
    const res = await User.updateOne(
      { _id: userId },
      { $inc: { points: amount, totalEarned: amount }, $set: { lastActiveAt: new Date() } },
      { session: s },
    );
    if (res.matchedCount !== 1) throw new NotFoundError("Utilisateur");
    await PointEvent.create([{ userId, amount, type, ...extra }], { session: s });
  });
}

/**
 * Débite `amount` points et journalise la dépense (montant négatif).
 * Le filtre `points >= amount` empêche le solde négatif et la double dépense.
 * Renvoie false si le solde est insuffisant ; rien n'est écrit dans ce cas.
 */
export async function spendPoints(
  userId: Id,
  amount: number,
  type: EventType,
  opts: { refId?: Id; session?: ClientSession } = {},
) {
  assertInt(amount, 1);
  const { session, ...extra } = opts;
  let spent = false;
  await inTransaction(session, async (s) => {
    const res = await User.updateOne(
      { _id: userId, points: { $gte: amount } },
      { $inc: { points: -amount } },
      { session: s },
    );
    spent = res.modifiedCount === 1;
    if (spent) await PointEvent.create([{ userId, amount: -amount, type, ...extra }], { session: s });
  });
  return spent;
}

function inTransaction(session: ClientSession | undefined, fn: (s: ClientSession) => Promise<void>) {
  return session ? fn(session) : mongoose.connection.transaction(fn);
}

function assertInt(amount: number, min: number) {
  if (!Number.isInteger(amount) || amount < min) throw new Error("Montant de points invalide");
}
