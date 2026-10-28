import { describe, expect, it } from "vitest";
import { apiError, call } from "@/test/api";
import * as profile from "./[username]/route";
import { GET } from "./route";

const usernames = (items: { username: string }[]) => items.map((item) => item.username);

describe("GET /api/users", () => {
  it("liste les autres comptes, sans le compte connecté", async () => {
    const res = await call(GET, { as: "alex" });

    expect(usernames(res.body.items)).toEqual(["lina.m", "karim.zen", "ines.lofi", "sam.off", "noah.detox"]);
  });

  it.each([
    ["LIN", ["lina.m"]],
    ["inès", ["ines.lofi"]],
    ["  zen ", ["karim.zen"]],
    ["personne", []],
  ])("cherche %j dans le nom d'utilisateur et le prénom", async (q, expected) => {
    const res = await call(GET, { as: "alex", query: { q } });

    expect(usernames(res.body.items)).toEqual(expected);
  });

  it("n'expose ni e-mail, ni hash, ni solde", async () => {
    const res = await call(GET, { as: "alex" });

    for (const item of res.body.items) {
      expect(item).not.toHaveProperty("email");
      expect(item).not.toHaveProperty("passwordHash");
      expect(item).not.toHaveProperty("points");
    }
    expect(res.body.items[0]).toMatchObject({ followedByMe: true, hasInstant: true });
  });
});

describe("GET /api/users/[username]", () => {
  const get = (username: string, as = "alex") => call(profile.GET, { as, params: { username } });

  it("renvoie le profil public, sans tenir compte de la casse", async () => {
    const res = await get("LINA.M");

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: "lina",
      username: "lina.m",
      name: "Lina",
      bio: "En ligne",
      status: "En ligne",
      level: 12,
      hasInstant: true,
      shielded: false,
      followers: 5,
      following: 4,
      followedByMe: true,
    });
  });

  it("n'ajoute pas followedByMe sur son propre profil", async () => {
    const res = await get("alex.detox");

    expect(res.body.user).not.toHaveProperty("followedByMe");
  });

  it("répond 404 pour un compte inconnu et 400 pour un nom mal formé", async () => {
    expect((await get("personne")).body).toEqual(apiError("NOT_FOUND", "Compte introuvable."));
    expect((await get("a b")).body).toEqual(apiError("INVALID_INPUT", "username mal formé."));
  });
});
