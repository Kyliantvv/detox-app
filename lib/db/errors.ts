// Ressource absente : à traduire en 404 côté route.
export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} introuvable`);
    this.name = "NotFoundError";
  }
}
