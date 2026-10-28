// Clairvoyance : catalogue des compétences par cible et achats.
import { describe, expect, it } from "vitest";
import { registerAccount } from "@/lib/server/accounts";
import { INTEL, SKILLS } from "@/lib/server/seed";
import { accountOf } from "@/lib/server/db";
import { apiError, call } from "@/test/api";
import * as skill from "./[skillId]/route";
import { GET } from "./route";

const catalog = (targetId: string) => call(GET, { as: "alex", query: { targetId } });
const unlock = (skillId: string, targetId: unknown = "lina") =>
  call(skill.POST, { as: "alex", params: { skillId }, body: { targetId } });

describe("GET /api/skills", () => {
  it("liste les compétences sans rien révéler tant que rien n'est acheté", async () => {
    const res = await catalog("lina");

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual(SKILLS.map((s) => ({ ...s, owned: false })));
    expect(res.body.intel).toEqual({});
  });

  it("indique ce qui a déjà été débloqué", async () => {
    await unlock("serie");

    const res = await catalog("lina");

    expect(res.body.items.filter((s: { owned: boolean }) => s.owned).map((s: { id: string }) => s.id)).toEqual(["serie"]);
    expect(res.body.intel).toEqual({ serie: "6 jours" });
  });

  it.each([
    ["sans cible", undefined, 400, apiError("INVALID_INPUT", "Paramètre targetId requis.")],
    ["sur soi-même", "alex", 404, apiError("NOT_FOUND", "Cible introuvable.")],
    ["sur un compte inconnu", "fantome", 404, apiError("NOT_FOUND", "Cible introuvable.")],
    ["sur un compte protégé par un bouclier", "sam", 409, apiError("TARGET_SHIELDED", "Cette cible est protégée par un bouclier.")],
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
      intel: { solde: "1 870" },
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
    const res = await unlock("dossier-complet", "karim");

    expect(res.body.owned).toEqual(SKILLS.map((s) => s.id));
    expect(res.body.intel).toEqual(INTEL.karim);
    expect(res.body.points).toBe(2455 - 800);
  });

  it("calcule l'information des vrais comptes sans les prévenir", async () => {
    const bob = registerAccount({ email: "bob@example.com", username: "bob", password: "secret1" }).user;
    const before = structuredClone(accountOf(bob.id));

    await unlock("solde", bob.id);
    const res = await unlock("serie", bob.id);

    expect(res.body.intel).toEqual({ solde: "525", serie: "1 jour" });
    expect(accountOf(bob.id)).toEqual(before);
  });

  it("refuse l'achat sans assez de points", async () => {
    accountOf("alex").points = 100;

    const res = await unlock("dossier-complet");

    expect(res.status).toBe(409);
    expect(res.body).toEqual(apiError("INSUFFICIENT_POINTS", "Il te manque 700 pts. Retourne scroller."));
    expect((await catalog("lina")).body.intel).toEqual({});
  });

  it.each([
    ["une compétence inconnue", "telepathie", "lina", 404, apiError("NOT_FOUND", "Compétence introuvable.")],
    ["un id de compétence mal formé", "solde!", "lina", 400, apiError("INVALID_INPUT", "skillId mal formé.")],
    ["une cible protégée", "solde", "sam", 409, apiError("TARGET_SHIELDED")],
    ["une cible mal formée", "solde", "lina karim", 400, apiError("INVALID_INPUT", "targetId mal formé.")],
    ["une cible qui n'est pas une chaîne", "solde", ["lina"], 400, apiError("INVALID_INPUT", "Champ « targetId » : string attendu.")],
  ])("refuse %s", async (_, skillId, targetId, status, error) => {
    const res = await unlock(skillId, targetId);

    expect(res.status).toBe(status);
    expect(res.body).toEqual(error);
    expect(accountOf("alex").points).toBe(2455);
  });
});
