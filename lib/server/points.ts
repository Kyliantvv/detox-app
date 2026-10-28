// Économie de points côté serveur : chaque gain ou débit écrit un PointEvent.
// Les montants viennent toujours d'ici, jamais du client.
import { COMBO_WINDOW_MS, POINTS, comboMultiplier } from "../game";
import type { PointEvent } from "../types";
import { accountOf, eventsOf, today, uid } from "./db";
import { ApiError } from "./http";

const MAX_EVENTS = 200;

function record(userId: string, amount: number, label: string): PointEvent {
  const event: PointEvent = { id: uid(), amount, label, at: Date.now() };
  const events = eventsOf(userId);
  events.unshift(event);
  events.length = Math.min(events.length, MAX_EVENTS);
  return event;
}

export function credit(userId: string, amount: number, label: string, { combo = false } = {}): PointEvent {
  const account = accountOf(userId);
  let finalAmount = amount;
  let finalLabel = label;
  if (combo) {
    const now = Date.now();
    const count = now - account.combo.lastAt < COMBO_WINDOW_MS ? account.combo.count + 1 : 1;
    account.combo = { count, lastAt: now };
    const multiplier = comboMultiplier(count);
    if (multiplier > 1) {
      finalAmount = Math.round(amount * multiplier);
      finalLabel = `${label} · combo ×${multiplier}`;
    }
  }
  account.points += finalAmount;
  account.totalEarned += finalAmount;
  account.earnedToday += finalAmount;
  account.bestGain = Math.max(account.bestGain, finalAmount);
  return record(userId, finalAmount, finalLabel);
}

// Vérification du solde et décrément dans la même opération synchrone :
// l'équivalent du `$inc` conditionnel de MongoDB, aucun appel concurrent ne peut s'intercaler.
export function debit(userId: string, amount: number, label: string): PointEvent {
  const account = accountOf(userId);
  if (account.points < amount) {
    throw new ApiError("INSUFFICIENT_POINTS", `Il te manque ${amount - account.points} pts. Retourne scroller.`);
  }
  account.points -= amount;
  account.totalSpent += amount;
  return record(userId, -amount, label);
}

// Connexion : série, remise à zéro du compteur du jour, bienvenue et bonus quotidien.
export function startSession(userId: string, firstTime: boolean): PointEvent[] {
  const account = accountOf(userId);
  const day = today();
  const yesterday = today(Date.now() - 86_400_000);
  const newDay = account.lastLoginDay !== day;
  if (newDay) {
    account.streak = account.lastLoginDay === yesterday ? account.streak + 1 : 1;
    account.earnedToday = 0;
    account.lastLoginDay = day;
  }
  account.lastSeenAt = Date.now();
  const gains: PointEvent[] = [];
  if (firstTime) gains.push(credit(userId, POINTS.welcome, "Cadeau de bienvenue"));
  if (newDay) gains.push(credit(userId, POINTS.dailyLogin, "Connexion du jour"));
  return gains;
}

// Réponse commune aux actions qui rapportent des points (pour le toast de gain).
export const withPoints = (userId: string, gains: PointEvent[]) => ({
  points: accountOf(userId).points,
  gains,
});
