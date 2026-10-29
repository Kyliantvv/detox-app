// Clairvoyance : les informations révélées sont calculées depuis la base.
import { describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { registerAccount } from "@/lib/server/accounts";
import { advanceTime, call, freezeTime } from "@/test/api";
import { USERS } from "@/test/db";
import * as dice from "../dice/route";
import * as orders from "../orders/route";
import * as users from "../users/[username]/route";
import * as skill from "./[skillId]/route";

const newAccount = async (username: string) =>
  (await registerAccount({ email: `${username}@example.com`, username, password: "secret1" })).user;
const spy = async (skillId: string, targetId: string) =>
  (await call(skill.POST, { as: "alex", params: { skillId }, body: { targetId } })).body.intel[skillId];
const visit = (as: string, username: string) => call(users.GET, { as, params: { username } });

describe("Clairvoyance : derniers achats", () => {
  it("compte les tickets et les loot box, pas seulement les commandes", async () => {
    freezeTime();
    const bob = await newAccount("bob");
    await db.user.update({ where: { id: bob.id }, data: { points: 5000 } });
    await call(orders.POST, { as: bob.id, body: { itemId: "sucre" } });
    advanceTime(1000);
    await call(dice.POST, { as: bob.id });
    advanceTime(1000);
    // Loot box vide : pas de sachet de sucre offert qui s'ajouterait aux achats.
    vi.spyOn(Math, "random").mockReturnValue(0.95);
    await call(orders.POST, { as: bob.id, body: { itemId: "lootbox" } });

    expect(await spy("derniers-achats", bob.id)).toBe("Loot box, Ticket à gratter, Sachet de sucre");
  });

  it("répond Aucun sans achat", async () => {
    const bob = await newAccount("bob");

    expect(await spy("derniers-achats", bob.id)).toBe("Aucun");
  });
});

describe("Clairvoyance : visites de profil", () => {
  it("révèle le profil que la cible a le plus visité", async () => {
    const bob = await newAccount("bob");
    await visit(bob.id, "karim.zen");
    await visit(bob.id, "lina.m");
    await visit(bob.id, "karim.zen");

    expect(await spy("visites-profil", bob.id)).toBe("A visité Karim 2 fois");
  });

  it("ne compte pas les visites de son propre profil", async () => {
    const bob = await newAccount("bob");
    await visit(bob.id, "bob");

    expect(await spy("visites-profil", bob.id)).toBe("N'a visité personne");
  });
});

describe("Clairvoyance : activité", () => {
  it("révèle le temps de scroll du jour, le plus gros gain et la dernière connexion", async () => {
    expect(await spy("temps-scroll", USERS.lina)).toBe("0 page");
    expect(await spy("plus-gros-gain", USERS.lina)).toBe("+2 750 (Points des jours précédents)".replace(" ", " "));
    expect(await spy("derniere-connexion", USERS.karim)).toBe("il y a 4 min");
  });
});
