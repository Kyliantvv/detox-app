import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Tests d'intégration sur une vraie base MongoDB en replica set (transactions).
// `docker compose up -d --wait mongo`, puis :
//   TEST_MONGODB_URI="mongodb://localhost:27017/detox_test?directConnection=true" pnpm test
// La base est vidée au début : son nom doit finir par `_test`.
const uri = process.env.TEST_MONGODB_URI;

describe.skipIf(!uri)("lib/db sur MongoDB", () => {
  let lib: typeof import(".");
  let n = 0;

  beforeAll(async () => {
    if (!new URL(uri!).pathname.endsWith("_test")) throw new Error("TEST_MONGODB_URI doit viser une base *_test");
    process.env.MONGODB_URI = uri;
    lib = await import(".");
    await lib.db.$runCommandRaw({ dropDatabase: 1 });
    execFileSync("pnpm", ["exec", "prisma", "db", "push", "--skip-generate"], { env: process.env, stdio: "ignore" });
    const failures = await lib.ensureIndexes();
    if (failures.length) throw new Error(JSON.stringify(failures));
  }, 60_000);

  afterAll(async () => {
    await lib?.db.$disconnect();
  });

  const newUser = (points = 0) => {
    n++;
    return lib.db.user.create({
      data: { email: ` User${n}@Example.com `, username: `User${n}`, passwordHash: "x", points, totalEarned: points },
    });
  };
  const newPost = async () => {
    const author = await newUser();
    return lib.db.post.create({ data: { authorId: author.id, type: "photo", mediaPath: "a.jpg", mediaMime: "image/jpeg" } });
  };
  const points = async (id: string) => (await lib.db.user.findUniqueOrThrow({ where: { id } })).points;

  it("crée tous les index requis", async () => {
    expect(await lib.missingIndexes()).toEqual([]);
  });

  it("normalise l'utilisateur et n'expose ni le hash ni les champs privés", async () => {
    const user = await newUser(40);
    expect(user.email).toMatch(/^user\d+@example\.com$/);
    expect(user).not.toHaveProperty("passwordHash");
    const pub = lib.toPublicUser(user);
    expect(pub).not.toHaveProperty("points");
    expect(pub).not.toHaveProperty("email");
    expect(pub).toMatchObject({ id: user.id, level: 1, online: false });
    expect(lib.toSelfJSON(user)).toMatchObject({ points: 40, level: 1 });
  });

  it("refuse les valeurs invalides", async () => {
    const user = await newUser();
    await expect(lib.db.user.update({ where: { id: user.id }, data: { bio: "x".repeat(151) } })).rejects.toBeInstanceOf(
      lib.InvalidInputError,
    );
    await expect(lib.db.follow.create({ data: { followerId: user.id, followingId: user.id } })).rejects.toBeInstanceOf(
      lib.InvalidInputError,
    );
    expect(() => lib.toId("pas-un-id")).toThrow(lib.InvalidInputError);
  });

  it("crédite une page de Flow une seule fois", async () => {
    const user = await newUser();
    await lib.creditPoints(user.id, 10, "flow_page", { flowPage: 1 });
    const dup = await lib.creditPoints(user.id, 10, "flow_page", { flowPage: 1 }).catch((e: unknown) => e);
    expect(lib.isDuplicateKey(dup)).toBe(true);
    expect(await points(user.id)).toBe(10);
    expect(await lib.flowPagesToday(user.id)).toBe(1);
    await expect(lib.creditPoints(user.id, 10, "flow_page")).rejects.toBeInstanceOf(lib.InvalidInputError);
  });

  it("crédite la connexion quotidienne une fois par jour", async () => {
    const user = await newUser();
    await lib.creditPoints(user.id, 25, "daily_login");
    const dup = await lib.creditPoints(user.id, 25, "daily_login").catch((e: unknown) => e);
    expect(lib.isDuplicateKey(dup)).toBe(true);
    expect(await points(user.id)).toBe(25);
  });

  it("ne débite pas au-delà du solde", async () => {
    const user = await newUser(100);
    await expect(lib.spendPoints(user.id, 150, "shop_purchase")).rejects.toBeInstanceOf(lib.InsufficientPointsError);
    await Promise.allSettled([lib.spendPoints(user.id, 60, "shop_purchase"), lib.spendPoints(user.id, 60, "shop_purchase")]);
    expect(await points(user.id)).toBe(40);
    expect(await lib.db.pointEvent.count({ where: { userId: user.id } })).toBe(1);
  });

  it("achète une compétence au prix de SKILLS, une seule fois", async () => {
    const [buyer, target] = [await newUser(500), await newUser()];
    const { purchase } = await lib.buySkill(buyer.id, target.id, "balance");
    expect(purchase.price).toBe(lib.SKILLS.balance);
    const dup = await lib.buySkill(buyer.id, target.id, "balance").catch((e: unknown) => e);
    expect(lib.isDuplicateKey(dup)).toBe(true);
    await expect(lib.buySkill(buyer.id, buyer.id, "balance")).rejects.toBeInstanceOf(lib.InvalidInputError);
    await expect(lib.buySkill(target.id, buyer.id, "balance")).rejects.toBeInstanceOf(lib.InsufficientPointsError);
    expect(await points(buyer.id)).toBe(500 - lib.SKILLS.balance);
  });

  it("tient le compteur de likes juste", async () => {
    const [post, user] = [await newPost(), await newUser()];
    const results = await Promise.all([lib.likePost(user.id, post.id), lib.likePost(user.id, post.id)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await lib.db.post.findUniqueOrThrow({ where: { id: post.id } })).likesCount).toBe(1);
    expect(await lib.unlikePost(user.id, post.id)).toBe(true);
    expect(await lib.unlikePost(user.id, post.id)).toBe(false);
    expect((await lib.db.post.findUniqueOrThrow({ where: { id: post.id } })).likesCount).toBe(0);
    await expect(lib.likePost(user.id, "0".repeat(24))).rejects.toBeInstanceOf(lib.NotFoundError);
  });

  it("tient le compteur de commentaires juste", async () => {
    const [post, user] = [await newPost(), await newUser()];
    const comment = await lib.addComment(user.id, post.id, "  salut  ");
    expect(comment.text).toBe("salut");
    await expect(lib.addComment(user.id, post.id, "x".repeat(501))).rejects.toBeInstanceOf(lib.InvalidInputError);
    expect(await lib.removeComment(post.authorId, comment.id)).toBe(false);
    expect(await lib.removeComment(user.id, comment.id)).toBe(true);
    expect((await lib.db.post.findUniqueOrThrow({ where: { id: post.id } })).commentsCount).toBe(0);
  });

  it("crée une seule conversation par paire", async () => {
    const [a, b] = [await newUser(), await newUser()];
    const convs = await Promise.all([lib.findOrCreateConversation(a.id, b.id), lib.findOrCreateConversation(b.id, a.id)]);
    expect(convs[0].id).toBe(convs[1].id);
    expect(await lib.db.conversation.count({ where: { pairKey: lib.conversationPairKey(a.id, b.id) } })).toBe(1);
  });

  it("compte l'activité, le combo et les posts vus", async () => {
    const user = await newUser();
    const t0 = new Date("2026-01-01T10:00:00Z");
    await lib.recordActivity(user.id, t0);
    await lib.recordActivity(user.id, new Date(t0.getTime() + 30_000));
    const after = await lib.db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.timeSpentSec).toBe(30);
    expect(after.lastActiveAt).toEqual(new Date(t0.getTime() + 30_000));

    expect(await lib.bumpCombo(user.id, t0)).toBe(1);
    expect(await lib.bumpCombo(user.id, new Date(t0.getTime() + 3_000))).toBe(2);
    expect(await lib.bumpCombo(user.id, new Date(t0.getTime() + 60_000))).toBe(1);

    await lib.recordPostsSeen(user.id, 30, t0);
    expect(await lib.recordPostsSeen(user.id, 30, t0)).toEqual({ total: 60, today: 60, untilChest: 20 });
    await expect(lib.recordActivity("0".repeat(24))).rejects.toBeInstanceOf(lib.NotFoundError);
  });

  it("masque un tirage ouvert", async () => {
    const user = await newUser();
    const draw = await lib.db.draw.create({
      data: { userId: user.id, kind: "scratch", payout: 50, cells: [{ value: 5, revealed: true }, { value: 9 }] },
    });
    const json = lib.toDrawJSON(draw);
    expect(json.cells).toEqual([{ value: 5, revealed: true }, { revealed: false }]);
    expect(json).not.toHaveProperty("payout");
  });
});
