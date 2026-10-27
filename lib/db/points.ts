import mongoose, { type Types } from "mongoose";
import { POINT_EVENT_TYPES, PointEvent } from "./models/point-event";
import { User } from "./models/user";

type Id = Types.ObjectId | string;
type EventType = (typeof POINT_EVENT_TYPES)[number];

export class InsufficientPointsError extends Error {
  constructor() {
    super("Solde insuffisant");
  }
}

// Chaque mouvement de points écrit le solde et son PointEvent dans la même
// transaction : l'un ne peut pas exister sans l'autre.

/**
 * Crédite `amount` points et journalise le gain.
 * Pour une page de Flow, passer `flowPage` : un second crédit de la même page
 * lève une erreur E11000 (code 11000) et rien n'est crédité.
 */
export async function creditPoints(
  userId: Id,
  amount: number,
  type: EventType,
  extra: { flowPage?: number; refId?: Id } = {},
) {
  assertPositiveInt(amount);
  await mongoose.connection.transaction(async (session) => {
    await PointEvent.create([{ userId, amount, type, ...extra }], { session });
    await User.updateOne(
      { _id: userId },
      { $inc: { points: amount, totalEarned: amount }, $set: { lastActiveAt: new Date() } },
      { session },
    );
  });
}

/**
 * Débite `amount` points et journalise la dépense (montant négatif).
 * Le filtre `points >= amount` empêche le solde négatif et la double dépense.
 * Renvoie false si le solde est insuffisant ; rien n'est écrit dans ce cas.
 */
export async function spendPoints(userId: Id, amount: number, type: EventType, extra: { refId?: Id } = {}) {
  assertPositiveInt(amount);
  try {
    await mongoose.connection.transaction(async (session) => {
      const res = await User.updateOne(
        { _id: userId, points: { $gte: amount } },
        { $inc: { points: -amount } },
        { session },
      );
      if (res.modifiedCount !== 1) throw new InsufficientPointsError();
      await PointEvent.create([{ userId, amount: -amount, type, ...extra }], { session });
    });
    return true;
  } catch (err) {
    if (err instanceof InsufficientPointsError) return false;
    throw err;
  }
}

function assertPositiveInt(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Montant de points invalide");
}
