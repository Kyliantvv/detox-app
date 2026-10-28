// Clairvoyance : catalogue des compétences par cible et achats.
import { describe, expect, it } from "vitest";
import { db, SKILLS } from "@/lib/db";
import { registerAccount } from "@/lib/server/accounts";
import { SKILL_CATALOG } from "@/lib/server/content";
import { apiError, call } from "@/test/api";
import { USERS, userRow } from "@/test/db";
import * as skill from "./[skillId]/route";
import { GET } from "./route";

const catalog = (targetId: string) => call(GET, { as: "alex", query: { targetId } });
const unlock = (skillId: string, targetId: unknown = USERS.lina) =>
  call(skill.POST, { as: "alex", params: { skillId }, body: { targetId } });

describe("GET /api/skills", () => {
  it("liste les compétences sans rien révéler tant que rien n'est acheté", async () => {
    const res = await catalog(USERS.lina);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual(
      SKILL_CATALOG.map(({ id, name, shows, skill }) => ({ id, name, shows, price: SKILLS[skill], owned: false })),
    );
    expect(res.body.intel).toEqual({});
  });

  it("indique ce qui a déjà été débloqué", async () => {
    await unlock("serie");

    const res = await catalog(USERS.lina);

    expect(res.body.items.filter((s: { owned: boolean }) => s.owned).map((s: { id: string }) => s.id)).toEqual(["serie"]);
    expect(res.body.intel).toEqual({ serie: "6 jours" });
  });

  it.each([
    ["sans cible", undefined, 400, apiError("INVALID_INPUT", "Paramètre targetId requis.")],
    ["sur soi-même", USERS.alex, 404, apiError("NOT_FOUND", "Cible introuvable.")],
    ["sur un compte inconnu", "0".repeat(24), 404, apiError("NOT_FOUND", "Cible introuvable.")],
    ["sur un compte protégé par un bouclier", USERS.sam, 409, apiError("TARGET_SHIELDED", "Cette cible est protégée par un bouclier.")],
  ])("refuse %s", async (_, targetId, status, error) => {
    const res = await call(GET, { as: "alex", query: targetId ? { targetId } : {} });

    expect(res.status).toBe(status);
    expect(res.body).toEqual(error);
  });
});

describe("POST /api/skills/[skillId]", () => {
  it("débite la compétence et révèle l'information", async () => {
    const res = await unlock("solde");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      owned: ["solde"],
      intel: { solde: (1870).toLocaleString("fr-FR") },
      points: 2455 - 150,
      events: [expect.objectContaining({ amount: -150, label: "Clairvoyance : Solde" })],
    });
  });

  it("ne débite pas deux fois une compétence déjà possédée", async () => {
    await unlock("solde");

    const res = await unlock("solde");

    expect(res.body).toMatchObject({ owned: ["solde"], points: 2455 - 150, events: [] });
  });

  it("débloque tout avec le dossier complet", async () => {
    const res = await unlock("dossier-complet", USERS.karim);

    expect(res.body.owned).toEqual(SKILL_CATALOG.map((s) => s.id));
    expect(Object.keys(res.body.intel)).toEqual(SKILL_CATALOG.slice(0, -1).map((s) => s.id));
    expect(res.body.intel).toMatchObject({ serie: "14 jours", "cercle-proche": "4 comptes", "derniers-achats": "Aucun" });
    expect(res.body.points).toBe(2455 - 800);
    expect(await db.skillPurchase.count()).toBe(1);
  });

  it("calcule l'information des vrais comptes sans les prévenir", async () => {
    const bob = (await registerAccount({ email: "bob@example.com", username: "bob", password: "secret1" })).user;
    const before = await userRow(bob.id);

    await unlock("solde", bob.id);
    const res = await unlock("serie", bob.id);

    expect(res.body.intel).toEqual({ solde: "525", serie: "1 jour" });
    expect(await userRow(bob.id)).toEqual(before);
  });

  it("refuse l'achat sans assez de points", async () => {
    await db.user.update({ where: { id: USERS.alex }, data: { points: 100 } });

    const res = await unlock("dossier-complet");

    expect(res.status).toBe(409);
    expect(res.body).toEqual(apiError("INSUFFICIENT_POINTS", "Il te manque 700 pts. Retourne scroller."));
    expect((await catalog(USERS.lina)).body.intel).toEqual({});
  });

  it.each([
    ["une compétence inconnue", "telepathie", USERS.lina, 404, apiError("NOT_FOUND", "Compétence introuvable.")],
    ["un id de compétence mal formé", "solde!", USERS.lina, 404, apiError("NOT_FOUND", "Compétence introuvable.")],
    ["une cible protégée", "solde", USERS.sam, 409, apiError("TARGET_SHIELDED")],
    ["une cible mal formée", "solde", "lina karim", 400, apiError("INVALID_INPUT", "targetId invalide")],
    ["une cible qui n'est pas une chaîne", "solde", [USERS.lina], 400, apiError("INVALID_INPUT", "Champ « targetId » : string attendu.")],
  ])("refuse %s", async (_, skillId, targetId, status, error) => {
    const res = await unlock(skillId, targetId);

    expect(res.status).toBe(status);
    expect(res.body).toEqual(error);
    expect((await userRow("alex")).points).toBe(2455);
  });
});
