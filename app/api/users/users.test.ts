import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiError, call } from "@/test/api";
import { USERS } from "@/test/db";
import * as profile from "./[username]/route";
import { GET } from "./route";

const usernames = (items: { username: string }[]) => items.map((item) => item.username);

describe("GET /api/users", () => {
  it("liste les autres comptes, sans le compte connecté, les comptes suivis d'abord", async () => {
    await db.user.create({ data: { email: "aaron@example.com", username: "aaron", passwordHash: "x" } });

    const res = await call(GET, { as: "alex" });

    expect(usernames(res.body.items)).toEqual(["ines.lofi", "karim.zen", "lina.m", "noah.detox", "aaron", "sam.off"]);
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
    expect(res.body.items[0]).toMatchObject({ username: "ines.lofi", followedByMe: true, hasInstant: true });
  });
});

describe("GET /api/users/[username]", () => {
  const get = (username: string, as = "alex") => call(profile.GET, { as, params: { username } });

  it("renvoie le profil public, sans tenir compte de la casse", async () => {
    const res = await get("LINA.M");

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: USERS.lina,
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

  it("enregistre la visite pour la Clairvoyance, sauf sur son propre profil", async () => {
    await get("lina.m");
    await get("alex.detox");

    expect(await db.profileView.findMany({ select: { viewerId: true, profileId: true } })).toEqual([
      { viewerId: USERS.alex, profileId: USERS.lina },
    ]);
  });

  it("calcule le statut depuis la dernière activité", async () => {
    expect((await get("karim.zen")).body.user.status).toBe("Connecté il y a 4 min");
    expect((await get("noah.detox")).body.user.status).toBe("Connecté hier");
    expect((await get("sam.off")).body.user.status).toBe("Bouclier actif");
  });

  it("répond 404 pour un compte inconnu et 400 pour un nom mal formé", async () => {
    expect((await get("personne")).body).toEqual(apiError("NOT_FOUND", "Compte introuvable."));
    expect((await get("a b")).body).toEqual(apiError("INVALID_INPUT", "username mal formé."));
  });
});
