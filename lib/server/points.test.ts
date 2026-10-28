import { describe, expect, it } from "vitest";
import { COMBO_WINDOW_MS, POINTS } from "../game";
import { advanceTime, freezeTime } from "@/test/api";
import { accountOf, eventsOf, today } from "./db";
import { ApiError } from "./http";
import { credit, debit, startSession, withPoints } from "./points";

// Compte vierge : accountOf() le crée au premier accès.
const USER = "nouveau";

describe("credit", () => {
  it("met à jour le solde, les totaux et le meilleur gain", () => {
    credit(USER, 40, "Test");
    credit(USER, 10, "Test");

    expect(accountOf(USER)).toMatchObject({ points: 50, totalEarned: 50, earnedToday: 50, bestGain: 40 });
    expect(eventsOf(USER).map((event) => event.amount)).toEqual([10, 40]);
  });

  it("ne garde que les 200 derniers événements", () => {
    for (let i = 0; i < 205; i++) credit(USER, 1, `Gain ${i}`);

    expect(eventsOf(USER)).toHaveLength(200);
    expect(eventsOf(USER)[0].label).toBe("Gain 204");
  });

  it("multiplie les actions enchaînées dans la fenêtre du combo", () => {
    freezeTime();
    const amounts = Array.from({ length: 10 }, () => credit(USER, 10, "Like", { combo: true }).amount);

    expect(amounts).toEqual([10, 10, 10, 10, 15, 15, 15, 15, 15, 20]);
  });

  it("remet le combo à zéro après une pause", () => {
    freezeTime();
    for (let i = 0; i < 4; i++) credit(USER, 10, "Like", { combo: true });

    advanceTime(COMBO_WINDOW_MS);
    const event = credit(USER, 10, "Like", { combo: true });

    expect(event).toMatchObject({ amount: 10, label: "Like" });
  });
});

describe("debit", () => {
  it("débite et compte la dépense", () => {
    credit(USER, 100, "Test");

    const event = debit(USER, 30, "Achat");

    expect(event.amount).toBe(-30);
    expect(accountOf(USER)).toMatchObject({ points: 70, totalSpent: 30, totalEarned: 100 });
  });

  it("refuse un débit supérieur au solde sans rien modifier", () => {
    credit(USER, 20, "Test");

    expect(() => debit(USER, 50, "Achat")).toThrow(new ApiError("INSUFFICIENT_POINTS", "Il te manque 30 pts. Retourne scroller."));
    expect(accountOf(USER)).toMatchObject({ points: 20, totalSpent: 0 });
    expect(eventsOf(USER)).toHaveLength(1);
  });

  it("autorise un débit égal au solde", () => {
    credit(USER, 50, "Test");

    debit(USER, 50, "Achat");

    expect(accountOf(USER).points).toBe(0);
  });
});

describe("startSession", () => {
  it("offre la bienvenue et la connexion du jour au premier passage", () => {
    const gains = startSession(USER, true);

    expect(gains.map((gain) => gain.amount)).toEqual([POINTS.welcome, POINTS.dailyLogin]);
    expect(accountOf(USER)).toMatchObject({ streak: 1, lastLoginDay: today() });
  });

  it("prolonge la série d'un jour à l'autre et remet à zéro les gains du jour", () => {
    freezeTime();
    startSession(USER, true);

    advanceTime(86_400_000);
    const gains = startSession(USER, false);

    expect(gains).toHaveLength(1);
    expect(accountOf(USER)).toMatchObject({ streak: 2, earnedToday: POINTS.dailyLogin });
  });

  it("ne crédite rien de plus le même jour", () => {
    startSession(USER, true);

    expect(startSession(USER, false)).toEqual([]);
    expect(accountOf(USER).streak).toBe(1);
  });
});

describe("withPoints", () => {
  it("joint le solde actuel aux gains", () => {
    const gains = [credit(USER, 5, "Test")];

    expect(withPoints(USER, gains)).toEqual({ points: 5, gains });
  });
});
