import type { ClientSession } from "mongoose";
import { InsufficientPointsError, InvalidInputError, NotFoundError } from "./errors";
import { type Id, inTransaction, toObjectId } from "./ids";
import { PointEvent, type PointEventType } from "./models/point-event";
import { User } from "./models/user";

// Chaque mouvement de points écrit le solde et son PointEvent dans la même
// transaction : l'un ne peut pas exister sans l'autre.
//
// Sans `session`, chaque fonction ouvre sa propre transaction. Pour lier le
// mouvement à une autre écriture (achat, commande, tirage), passer la session
// de sa propre transaction : tout est validé ou annulé ensemble (voir buySkill).

type Opts = { refId?: Id; session?: ClientSession };

/**
 * Crédite `amount` points (0 ne fait rien, pratique pour un tirage perdant).
 * Lève NotFoundError si l'utilisateur n'existe pas.
 * Pour une page de Flow, passer `flowPage` : un second crédit de la même page
 * lève une erreur E11000 (`isDuplicateKey`) et rien n'est crédité. Idem pour
 * une seconde connexion quotidienne le même jour.
 */
export async function creditPoints(userId: Id, amount: number, type: PointEventType, opts: Opts & { flowPage?: number } = {}) {
  assertInt(amount, 0);
  if (amount === 0) return;
  const { session, ...extra } = opts;
  const _id = toObjectId(userId, "Utilisateur");
  await inTransaction(session, async (s) => {
    const res = await User.updateOne({ _id }, { $inc: { points: amount, totalEarned: amount } }, { session: s });
    if (res.matchedCount !== 1) throw new NotFoundError("Utilisateur");
    await PointEvent.create([{ userId: _id, amount, type, ...extra }], { session: s });
  });
}

/**
 * Débite `amount` points et journalise la dépense (montant négatif).
 * Le filtre `points >= amount` empêche le solde négatif et la double dépense.
 * Lève InsufficientPointsError si le solde ne suffit pas ; rien n'est écrit.
 * Une perte (ticket perdant) passe par ici, jamais par un crédit négatif.
 */
export async function spendPoints(userId: Id, amount: number, type: PointEventType, opts: Opts = {}) {
  assertInt(amount, 1);
  const { session, ...extra } = opts;
  const _id = toObjectId(userId, "Utilisateur");
  await inTransaction(session, async (s) => {
    const res = await User.updateOne({ _id, points: { $gte: amount } }, { $inc: { points: -amount } }, { session: s });
    if (res.modifiedCount !== 1) throw new InsufficientPointsError();
    await PointEvent.create([{ userId: _id, amount: -amount, type, ...extra }], { session: s });
  });
}

function assertInt(amount: number, min: number) {
  if (!Number.isInteger(amount) || amount < min) throw new InvalidInputError("Montant de points invalide");
}
