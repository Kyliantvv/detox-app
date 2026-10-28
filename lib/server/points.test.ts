import { describe, expect, it } from "vitest";
import { db, parisDay } from "@/lib/db";
import { COMBO_WINDOW_MS, POINTS } from "../game";
import { advanceTime, freezeTime } from "@/test/api";
import { USERS, userRow } from "@/test/db";
import { ApiError } from "./http";
import { credit, debit, startSession, withPoints } from "./points";

// Compte vierge, sans points ni série.
const fresh = async () =>
  (await db.user.create({ data: { email: "nouveau@example.com", username: "nouveau", passwordHash: "x" } })).id;
const events = (userId: string) => db.pointEvent.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });

describe("credit", () => {
  it("met à jour le solde et le cumul, et journalise le gain", async () => {
    const user = await fresh();
    await credit(user, 40, "bonus", "Test");
    await credit(user, 10, "bonus", "Test");

    expect(await userRow(user)).toMatchObject({ points: 50, totalEarned: 50 });
    expect((await events(user)).map((event) => event.amount).sort()).toEqual([10, 40]);
  });

  it("renvoie le gain au format de l'API", async () => {
    const user = await fresh();

    const [gain] = await credit(user, 5, "bonus", "Test");

    expect(gain).toEqual({ id: expect.any(String), amount: 5, label: "Test", at: expect.any(Number) });
  });

  it("multiplie les actions enchaînées dans la fenêtre du combo", async () => {
    freezeTime();
    const user = await fresh();
    const amounts = [];
    for (let i = 0; i < 10; i++) amounts.push((await credit(user, 10, "like", "Like", { combo: true }))[0].amount);

    expect(amounts).toEqual([10, 10, 10, 10, 15, 15, 15, 15, 15, 20]);
  });

  it("remet le combo à zéro après une pause", async () => {
    freezeTime();
    const user = await fresh();
    for (let i = 0; i < 4; i++) await credit(user, 10, "like", "Like", { combo: true });

    advanceTime(COMBO_WINDOW_MS);
    const [event] = await credit(user, 10, "like", "Like", { combo: true });

    expect(event).toMatchObject({ amount: 10, label: "Like" });
  });
});

describe("debit", () => {
  it("débite sans toucher au cumul des gains", async () => {
    const user = await fresh();
    await credit(user, 100, "bonus", "Test");

    const event = await debit(user, 30, "shop_purchase", "Achat");

    expect(event.amount).toBe(-30);
    expect(await userRow(user)).toMatchObject({ points: 70, totalEarned: 100 });
  });

  it("refuse un débit supérieur au solde sans rien modifier", async () => {
    const user = await fresh();
    await credit(user, 20, "bonus", "Test");

    await expect(debit(user, 50, "shop_purchase", "Achat")).rejects.toThrow(
      new ApiError("INSUFFICIENT_POINTS", "Il te manque 30 pts. Retourne scroller."),
    );
    expect((await userRow(user)).points).toBe(20);
    expect(await events(user)).toHaveLength(1);
  });

  it("autorise un débit égal au solde", async () => {
    const user = await fresh();
    await credit(user, 50, "bonus", "Test");

    await debit(user, 50, "shop_purchase", "Achat");

    expect((await userRow(user)).points).toBe(0);
  });
});

describe("startSession", () => {
  it("offre la bienvenue et la connexion du jour au premier passage", async () => {
    const user = await fresh();

    const gains = await startSession(user, true);

    expect(gains.map((gain) => gain.amount)).toEqual([POINTS.welcome, POINTS.dailyLogin]);
    expect((await userRow(user)).streak).toEqual({ current: 1, best: 1, lastLoginDay: parisDay() });
  });

  it("prolonge la série d'un jour à l'autre", async () => {
    freezeTime();
    const user = await fresh();
    await startSession(user, true);

    advanceTime(86_400_000);
    const gains = await startSession(user, false);

    expect(gains).toHaveLength(1);
    expect((await userRow(user)).streak?.current).toBe(2);
  });

  it("ne crédite rien de plus le même jour", async () => {
    const user = await fresh();
    await startSession(user, true);

    expect(await startSession(user, false)).toEqual([]);
    expect((await userRow(user)).streak?.current).toBe(1);
  });
});

describe("withPoints", () => {
  it("joint le solde actuel aux gains", async () => {
    const gains = await credit(USERS.alex, 5, "bonus", "Test");

    expect(await withPoints(USERS.alex, gains)).toEqual({ points: 2460, gains });
  });
});
