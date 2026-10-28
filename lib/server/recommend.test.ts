// Algorithme de recommandation : profil de goûts, score, sélection des pages du Flow et des Reels.
import { describe, expect, it, vi } from "vitest";
import { registerAccount } from "@/lib/server/accounts";
import { db, findPost, followingOf } from "@/lib/server/db";
import { call } from "@/test/api";
import * as reels from "@/app/api/feed/reels/route";
import { FLOW_PER_PAGE, REASONS, flowRecommendations, scorePost, tasteOf } from "./recommend";

// Un compte sans historique ni abonnements : l'inscription abonne d'office à 4 comptes, on les retire.
const newUser = () => {
  const { id } = registerAccount({ email: "bob@example.com", username: "bob", password: "secret1" }).user;
  followingOf(id).clear();
  return id;
};
// Hasard figé : enregistré après la création du compte, car uid() dépend aussi de Math.random.
const fixRandom = () => vi.spyOn(Math, "random").mockReturnValue(0.5);
const like = (userId: string, postId: string) => db().likes.add(`${userId}:${postId}`);
const authorOf = (id: string) => findPost(id)!.authorId;
// Dans le Flow, f0, f5, f10, f15… sont de Lina ; f1, f6… de Karim.

describe("tasteOf", () => {
  it("additionne les poids de chaque action par auteur et par visuel", () => {
    const bob = newUser();
    like(bob, "f0");
    db().saves.add(`${bob}:f5`);
    followingOf(bob).add("karim");
    db().profileViews.set(bob, new Map([["noah", 3]]));

    const taste = tasteOf(bob);

    expect(taste.authors.get("lina")).toBe(3 + 4);
    expect(taste.authors.get("karim")).toBe(6);
    expect(taste.authors.get("noah")).toBe(2 * 3);
    expect(taste.arts.get(findPost("f0")!.art)).toBeGreaterThanOrEqual(1);
  });

  it("compte les commentaires de l'utilisateur", () => {
    const bob = newUser();
    db().comments.set("f1", [{ author: "bob", text: "Trop bien", at: Date.now() }]);

    expect(tasteOf(bob).authors.get("karim")).toBe(5);
  });
});

describe("scorePost", () => {
  it("explique le score par sa plus grosse part", () => {
    const bob = newUser();
    followingOf(bob).add("karim");
    db().saves.add(`${bob}:f0`);
    const taste = tasteOf(bob);
    // Un post d'Inès (f2) avec le même visuel que f0 : seul le visuel compte.
    const sameArt = { ...findPost("f2")!, art: findPost("f0")!.art };

    expect(scorePost(findPost("f5")!, taste).reason).toBe(REASONS.interest("Lina"));
    expect(scorePost(findPost("f1")!, taste).reason).toBe(REASONS.follow("Karim"));
    expect(scorePost(sameArt, taste).reason).toBe(REASONS.art);
    expect(scorePost(findPost("f3")!, taste).reason).toBe(REASONS.popular);
  });
});

describe("flowRecommendations", () => {
  it("met en tête les posts de l'auteur que l'utilisateur aime, plus une surprise", () => {
    const bob = newUser();
    like(bob, "f0");
    like(bob, "f5");
    fixRandom();

    const page = flowRecommendations(bob, 0);

    expect(page).toHaveLength(FLOW_PER_PAGE);
    const surprises = page.filter(({ reason }) => reason === REASONS.surprise);
    expect(surprises).toHaveLength(1);
    const targeted = page.filter(({ reason }) => reason !== REASONS.surprise);
    expect(targeted.map(({ post }) => post.authorId)).toEqual(["lina", "lina", "lina", "lina"]);
    expect(targeted.every(({ reason }) => reason === REASONS.interest("Lina"))).toBe(true);
  });

  it("sans historique, recommande les posts les plus populaires", () => {
    const bob = newUser();
    fixRandom();

    const targeted = flowRecommendations(bob, 0).filter(({ reason }) => reason !== REASONS.surprise);
    const doses = targeted.map(({ post }) => post.baseDoses);

    expect(targeted.every(({ reason }) => reason === REASONS.popular)).toBe(true);
    expect(doses).toEqual([...doses].sort((a, b) => b - a));
  });

  it("garde une page identique quand on la relit, même si les goûts ont changé", () => {
    const bob = newUser();
    const first = flowRecommendations(bob, 2).map(({ post }) => post.id);
    like(bob, "f41");

    expect(flowRecommendations(bob, 2).map(({ post }) => post.id)).toEqual(first);
  });

  it("ne propose jamais deux fois le même post", () => {
    const bob = newUser();
    const seen = [0, 1, 2, 3, 4].flatMap((page) => flowRecommendations(bob, page).map(({ post }) => post.id));

    expect(new Set(seen).size).toBe(seen.length);
  });

  it("calcule les pages séparément pour chaque utilisateur", () => {
    const bob = newUser();
    like(bob, "f1");
    fixRandom();

    const forBob = flowRecommendations(bob, 0).filter(({ reason }) => reason !== REASONS.surprise);

    expect(forBob.every(({ post }) => authorOf(post.id) === "karim")).toBe(true);
    expect(db().flowPages.get("alex")).toBeUndefined();
  });
});

describe("GET /api/feed/reels", () => {
  it("met en tête les reels de l'auteur aimé, avec leur raison", async () => {
    const bob = newUser();
    like(bob, "c1");
    const linaReel = [...db().posts.values()].find((post) => post.isReel && post.authorId === authorOf("c1"))!;

    const res = await call(reels.GET, { as: bob });

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({ id: linaReel.id, reason: expect.stringContaining("Parce que") });
    expect(res.body.items.every((item: { isReel: boolean }) => item.isReel)).toBe(true);
  });

  it("répond 401 sans token", async () => {
    expect((await call(reels.GET)).status).toBe(401);
  });
});
