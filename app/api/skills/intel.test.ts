// Clairvoyance sur les vrais comptes : « Derniers achats » et « Visites de profil ».
import { describe, expect, it } from "vitest";
import { registerAccount } from "@/lib/server/accounts";
import { accountOf } from "@/lib/server/db";
import { call } from "@/test/api";
import * as dice from "../dice/route";
import * as orders from "../orders/route";
import * as users from "../users/[username]/route";
import * as skill from "./[skillId]/route";

// Un vrai compte : les comptes seedés ont des fiches figées (INTEL).
const newAccount = (username: string) =>
  registerAccount({ email: `${username}@example.com`, username, password: "secret1" }).user;
const spy = async (skillId: string, targetId: string) =>
  (await call(skill.POST, { as: "alex", params: { skillId }, body: { targetId } })).body.intel[skillId];
const visit = (as: string, username: string) => call(users.GET, { as, params: { username } });

describe("Clairvoyance : derniers achats", () => {
  it("compte les tickets et les loot box, pas seulement les commandes", async () => {
    const bob = newAccount("bob");
    accountOf(bob.id).points = 5000;
    await call(orders.POST, { as: bob.id, body: { itemId: "sucre" } });
    await call(dice.POST, { as: bob.id });
    await call(orders.POST, { as: bob.id, body: { itemId: "lootbox" } });

    expect(await spy("derniers-achats", bob.id)).toBe("Loot box, Ticket à gratter, Sachet de sucre");
  });

  it("répond Aucun sans achat", async () => {
    const bob = newAccount("bob");

    expect(await spy("derniers-achats", bob.id)).toBe("Aucun");
  });
});

describe("Clairvoyance : visites de profil", () => {
  it("révèle le profil que la cible a le plus visité", async () => {
    const bob = newAccount("bob");
    await visit(bob.id, "karim.zen");
    await visit(bob.id, "lina.m");
    await visit(bob.id, "karim.zen");

    expect(await spy("visites-profil", bob.id)).toBe("A visité Karim 2 fois");
  });

  it("ne compte pas les visites de son propre profil", async () => {
    const bob = newAccount("bob");
    await visit(bob.id, "bob");

    expect(await spy("visites-profil", bob.id)).toBe("N'a visité personne");
  });
});
