import mongoose, { type ClientSession, isValidObjectId, Types } from "mongoose";
import { InvalidInputError } from "./errors";

/** Id accepté par les helpers de lib/db : ObjectId ou sa forme texte (paramètre de route). */
export type Id = Types.ObjectId | string;

/** Contrat d'API : un id mal formé donne 400, pas une CastError en 500. */
export function toObjectId(id: Id, what = "id") {
  if (!isValidObjectId(id)) throw new InvalidInputError(`${what} invalide`);
  return new Types.ObjectId(String(id));
}

/** Exécute `fn` dans la transaction de l'appelant, ou dans une nouvelle si `session` est absent. */
export function inTransaction<T>(session: ClientSession | undefined, fn: (s: ClientSession) => Promise<T>) {
  return session ? fn(session) : mongoose.connection.transaction(fn);
}
