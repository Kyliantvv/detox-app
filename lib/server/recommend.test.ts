// Algorithme de recommandation : profil de goûts, score, sélection des pages du Flow et des Reels.
import { describe, expect, it, vi } from "vitest";
import { db, likePost } from "@/lib/db";
import { registerAccount } from "@/lib/server/accounts";
import { call } from "@/test/api";
import { POSTS, USERS } from "@/test/db";
import * as reels from "@/app/api/feed/reels/route";
import { FLOW_PER_PAGE, REASONS, flowRecommendations, rank, scorePost, tasteOf } from "./recommend";

// Un compte sans historique ni abonnements : l'inscription abonne d'office à 4 comptes, on les retire.
const newUser = async () => {
  const { id } = (await registerAccount({ email: "bob@example.com", username: "bob", password: "secret1" })).user;
  await db.follow.deleteMany({ where: { followerId: id } });
  return id;
};
const fixRandom = () => vi.spyOn(Math, "random").mockReturnValue(0.5);
const post = (key: string) => db.post.findUniqueOrThrow({ where: { id: POSTS[key] } });
const names = new Map([[USERS.lina, "Lina"], [USERS.karim, "Karim"], [USERS.ines, "Inès"], [USERS.noah, "Noah"]]);
// Dans le Flow, f0, f5, f10, f15… sont de Lina ; f1, f6… de Karim ; f2… d'Inès ; f3… de Noah ; f4… de Sam.

describe("tasteOf", () => {
  it("additionne les poids de chaque action par auteur et par visuel", async () => {
    const bob = await newUser();
    await likePost(bob, POSTS.f0);
    await db.save.create({ data: { userId: bob, postId: POSTS.f5 } });
    await db.follow.create({ data: { followerId: bob, followingId: USERS.karim } });
    await db.profileView.createMany({ data: Array.from({ length: 3 }, () => ({ viewerId: bob, profileId: USERS.noah })) });

    const taste = await tasteOf(bob);

    expect(taste.authors.get(USERS.lina)).toBe(3 + 4);
    expect(taste.authors.get(USERS.karim)).toBe(6);
    expect(taste.authors.get(USERS.noah)).toBe(2 * 3);
    expect(taste.arts.get((await post("f0")).art)).toBeGreaterThanOrEqual(1);
  });

  it("compte les commentaires de l'utilisateur", async () => {
    const bob = await newUser();
    await db.comment.create({ data: { postId: POSTS.f1, authorId: bob, text: "Trop bien" } });

    expect((await tasteOf(bob)).authors.get(USERS.karim)).toBe(5);
  });
});

describe("scorePost", () => {
  it("explique le score par sa plus grosse part", async () => {
    const bob = await newUser();
    await db.follow.create({ data: { followerId: bob, followingId: USERS.karim } });
    await db.save.create({ data: { userId: bob, postId: POSTS.f0 } });
    const taste = await tasteOf(bob);
    // Un post d'Inès (f2) avec le même visuel que f0 : seul le visuel compte.
    const sameArt = { ...(await post("f2")), art: (await post("f0")).art };

    expect(scorePost(await post("f5"), taste, names).reason).toBe(REASONS.interest("Lina"));
    expect(scorePost(await post("f1"), taste, names).reason).toBe(REASONS.follow("Karim"));
    expect(scorePost(sameArt, taste, names).reason).toBe(REASONS.art);
    expect(scorePost(await post("f3"), taste, names).reason).toBe(REASONS.popular);
  });
});

describe("rank", () => {
  it("trie du plus au moins recommandé", async () => {
    const bob = await newUser();
    await likePost(bob, POSTS.f1);
    fixRandom();

    const ranked = await rank([await post("f0"), await post("f6"), await post("f2")], bob);

    expect(ranked[0].post.id).toBe(POSTS.f6);
  });
});

describe("flowRecommendations", () => {
  it("met en tête les posts de l'auteur que l'utilisateur aime, plus une surprise", async () => {
    const bob = await newUser();
    await likePost(bob, POSTS.f0);
    await likePost(bob, POSTS.f5);
    fixRandom();

    const page = await flowRecommendations(bob, 0);

    expect(page).toHaveLength(FLOW_PER_PAGE);
    expect(page.filter(({ reason }) => reason === REASONS.surprise)).toHaveLength(1);
    const targeted = page.filter(({ reason }) => reason !== REASONS.surprise);
    expect(targeted.map(({ post }) => post.authorId)).toEqual(Array(4).fill(USERS.lina));
    expect(targeted.every(({ reason }) => reason === REASONS.interest("Lina"))).toBe(true);
  });

  it("sans historique, recommande les posts les plus populaires", async () => {
    const bob = await newUser();
    fixRandom();

    const targeted = (await flowRecommendations(bob, 0)).filter(({ reason }) => reason !== REASONS.surprise);
    const doses = targeted.map(({ post }) => post.baseLikes + post.likesCount);

    expect(targeted.every(({ reason }) => reason === REASONS.popular)).toBe(true);
    expect(doses).toEqual([...doses].sort((a, b) => b - a));
  });

  it("ne propose que des photos des autres comptes", async () => {
    const page = await flowRecommendations(USERS.lina, 0);

    expect(page.every(({ post }) => post.type === "photo" && post.authorId !== USERS.lina)).toBe(true);
  });

  it("garde une page identique quand on la relit, même si les goûts ont changé", async () => {
    const bob = await newUser();
    const first = (await flowRecommendations(bob, 1)).map(({ post }) => post.id);
    await likePost(bob, POSTS.f39);

    expect((await flowRecommendations(bob, 1)).map(({ post }) => post.id)).toEqual(first);
  });

  it("tire chaque page d'une réserve différente tant qu'il reste des posts", async () => {
    const bob = await newUser();
    const seen: string[] = [];
    for (const page of [0, 1]) seen.push(...(await flowRecommendations(bob, page)).map(({ post }) => post.id));

    // La maquette compte 44 photos d'autres comptes : de quoi remplir 2 réserves de FLOW_POOL.
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toHaveLength(2 * FLOW_PER_PAGE);
  });

  it("calcule les pages séparément pour chaque utilisateur", async () => {
    const bob = await newUser();
    await likePost(bob, POSTS.f1);
    fixRandom();

    const forBob = (await flowRecommendations(bob, 0)).filter(({ reason }) => reason !== REASONS.surprise);

    expect(forBob.every(({ post }) => post.authorId === USERS.karim)).toBe(true);
    expect(await db.flowPage.count({ where: { userId: USERS.alex } })).toBe(0);
  });
});

describe("GET /api/feed/reels", () => {
  it("met en tête les reels de l'auteur aimé, avec leur raison", async () => {
    const bob = await newUser();
    await likePost(bob, POSTS.c1);

    const res = await call(reels.GET, { as: bob });

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({ id: POSTS.r2, reason: expect.stringContaining("Parce que") });
    expect(res.body.items.every((item: { isReel: boolean }) => item.isReel)).toBe(true);
  });

  it("répond 401 sans token", async () => {
    expect((await call(reels.GET)).status).toBe(401);
  });
});
