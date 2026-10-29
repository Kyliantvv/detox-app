import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { getFiles } from "@/lib/files";
import { POINTS } from "@/lib/game";
import { CAPTION_MAX, COMMENT_MAX } from "@/lib/validation";
import { apiError, call } from "@/test/api";
import { POSTS, USERS, postKeys, userRow } from "@/test/db";
import * as circle from "../feed/circle/route";
import * as comments from "./[id]/comments/route";
import * as likes from "./[id]/likes/route";
import * as post from "./[id]/route";
import * as saves from "./[id]/saves/route";
import * as posts from "./route";

// Le stockage UploadThing est remplacé par l'adaptateur mémoire de files-sdk.
vi.mock("@/lib/files", async () => {
  const { createFiles } = await import("files-sdk");
  const { memory } = await import("files-sdk/memory");
  const files = createFiles({ adapter: memory() });
  return { getFiles: () => files };
});

// Ce que laisse un envoi par /api/files : le fichier stocké et sa ligne `media` (testé dans app/api/files).
async function uploaded(who: keyof typeof USERS, mime = "image/png") {
  const key = `${randomUUID()}.${mime.split("/")[1]}`;
  await getFiles().upload(key, new Uint8Array(8), { contentType: mime });
  await db.media.create({ data: { key, ownerId: USERS[who], mime, size: 8, usedAt: null } });
  return key;
}

describe("GET /api/posts", () => {
  it("renvoie la mosaïque d'exploration, rangée sous les filtres de la Recherche", async () => {
    const res = await call(posts.GET, { as: "alex", query: { explore: "1" } });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const tile of res.body.items) {
      expect(tile).toEqual({ id: expect.any(String), art: expect.any(String), tags: expect.arrayContaining(["Pour toi"]) });
    }
    const c1 = res.body.items.find((tile: { id: string }) => tile.id === POSTS.c1);
    expect(c1.tags).toEqual(expect.arrayContaining(["Amis", "Voyage"]));
  });

  it.each(["lina", "lina.m", "LINA.M"])("filtre par auteur (%s)", async (author) => {
    const res = await call(posts.GET, { as: "alex", query: { author: author === "lina" ? USERS.lina : author } });

    expect(postKeys(res.body.items)).toEqual(expect.arrayContaining(["c1", "r2", "f0", "f5"]));
    expect(res.body.items.every((post: { authorId: string }) => post.authorId === USERS.lina)).toBe(true);
  });

  it("répond 404 pour un auteur inconnu", async () => {
    const res = await call(posts.GET, { as: "alex", query: { author: "personne" } });

    expect(res.status).toBe(404);
    expect(res.body).toEqual(apiError("NOT_FOUND", "Auteur introuvable."));
  });

  it("filtre par type=reel", async () => {
    const res = await call(posts.GET, { as: "alex", query: { type: "reel" } });

    expect(postKeys(res.body.items).sort()).toEqual(["r1", "r2", "r3", "r4"]);
  });

  it("filtre par type=post, du plus récent au plus ancien", async () => {
    const res = await call(posts.GET, { as: "alex", query: { type: "post" } });

    expect(postKeys(res.body.items).slice(0, 3)).toEqual(["c1", "c2", "f0"]);
    expect(res.body.items.some((post: { isReel: boolean }) => post.isReel)).toBe(false);
  });

  it("refuse un type inconnu", async () => {
    const res = await call(posts.GET, { as: "alex", query: { type: "story" } });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(apiError("INVALID_INPUT", "type doit valoir reel ou post."));
  });

  it("retrouve les favoris du compte connecté", async () => {
    await call(saves.POST, { as: "alex", params: { id: POSTS.f7 } });
    await call(saves.POST, { as: "alex", params: { id: POSTS.c2 } });
    await call(saves.POST, { as: "lina", params: { id: POSTS.c3 } });

    const res = await call(posts.GET, { as: "alex", query: { saved: "1" } });

    expect(postKeys(res.body.items).sort()).toEqual(["c2", "f7"]);
    expect(res.body.items.every((post: { savedByMe: boolean }) => post.savedByMe)).toBe(true);
  });

  it("cache les posts réservés au cercle proche aux autres comptes", async () => {
    await db.post.update({ where: { id: POSTS.c2 }, data: { visibility: "closeFriends" } });
    await db.closeFriend.create({ data: { ownerId: USERS.karim, friendId: USERS.lina } });

    const forAlex = await call(posts.GET, { as: "alex", query: { author: "karim.zen" } });
    const forLina = await call(posts.GET, { as: "lina", query: { author: "karim.zen" } });

    expect(postKeys(forAlex.body.items)).not.toContain("c2");
    expect(postKeys(forLina.body.items)).toContain("c2");
    expect((await call(likes.POST, { as: "alex", params: { id: POSTS.c2 } })).status).toBe(404);
  });
});

describe("POST /api/posts", () => {
  it("publie une image envoyée par /api/files et crédite la publication", async () => {
    const mediaKey = await uploaded("alex");

    const res = await call(posts.POST, { as: "alex", body: { mediaKey, caption: "  Vue sur mon écran.  " } });

    expect(res.status).toBe(201);
    expect(res.body.post).toMatchObject({
      authorId: USERS.alex,
      caption: "Vue sur mon écran.",
      isReel: false,
      doses: 0,
      imageUrl: await getFiles().url(mediaKey),
    });
    expect(res.body.post.videoUrl).toBeUndefined();
    expect(res.body.gains).toEqual([expect.objectContaining({ amount: POINTS.reaction, label: "Publication" })]);
    expect(res.body.points).toBe(2455 + POINTS.reaction);
  });

  it("publie une vidéo comme reel", async () => {
    const mediaKey = await uploaded("alex", "video/mp4");

    const res = await call(posts.POST, { as: "alex", body: { mediaKey } });

    expect(res.body.post).toMatchObject({ isReel: true, caption: "", videoUrl: await getFiles().url(mediaKey) });
  });

  it("fait apparaître le post dans le cercle de son auteur", async () => {
    const { body } = await call(posts.POST, { as: "alex", body: { mediaKey: await uploaded("alex") } });

    const res = await call(circle.GET, { as: "alex" });

    expect(res.body.items[0].id).toBe(body.post.id);
  });

  it("refuse le fichier d'un autre compte", async () => {
    const mediaKey = await uploaded("lina");

    const res = await call(posts.POST, { as: "alex", body: { mediaKey } });

    expect(res.status).toBe(404);
    expect(res.body).toEqual(apiError("NOT_FOUND", "Média introuvable ou déjà publié."));
  });

  it("refuse un message vocal, et le fichier reste disponible", async () => {
    const mediaKey = await uploaded("alex", "audio/webm");

    const res = await call(posts.POST, { as: "alex", body: { mediaKey } });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(apiError("INVALID_INPUT", "Un post est une photo ou une vidéo."));
    expect(await db.media.findUnique({ where: { key: mediaKey } })).toMatchObject({ usedAt: null });
  });

  it("ne publie un fichier qu'une fois, même en parallèle", async () => {
    const mediaKey = await uploaded("alex");
    const before = await db.post.count();

    const results = await Promise.all([1, 2].map(() => call(posts.POST, { as: "alex", body: { mediaKey } })));

    expect(results.map((res) => res.status).sort()).toEqual([201, 404]);
    expect(await db.post.count()).toBe(before + 1);
  });

  it("refuse une clé jamais envoyée", async () => {
    const res = await call(posts.POST, { as: "alex", body: { mediaKey: `${randomUUID()}.png` } });

    expect(res.status).toBe(404);
  });

  it.each([
    ["sans média", { caption: "légende" }, "Champ « mediaKey » : string attendu."],
    ["une clé mal formée", { mediaKey: "../a.png" }, "mediaKey mal formé."],
    ["une légende trop longue", { mediaKey: "a.png", caption: "x".repeat(CAPTION_MAX + 1) }, `Légende : ${CAPTION_MAX} caractères maximum.`],
    ["un champ inconnu", { mediaKey: "a.png", authorId: "lina" }, "Champ(s) inconnu(s) : authorId."],
    ["un corps multipart", new FormData(), "Corps JSON invalide."],
  ])("refuse %s", async (_, body, message) => {
    const before = await db.post.count();

    const res = await call(posts.POST, { as: "alex", body });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(apiError("INVALID_INPUT", message));
    expect(await db.post.count()).toBe(before);
    expect((await userRow("alex")).points).toBe(2455);
  });
});

describe("GET /api/posts/[id]", () => {
  it("renvoie le post avec son auteur, ses commentaires et l'état du compte connecté", async () => {
    await call(likes.POST, { as: "alex", params: { id: POSTS.c1 } });

    const res = await call(post.GET, { as: "alex", params: { id: POSTS.c1 } });

    expect(res.status).toBe(200);
    expect(res.body.post).toMatchObject({
      id: POSTS.c1,
      author: { username: "lina.m" },
      dosedByMe: true,
      savedByMe: false,
      comments: [{ author: "karim.zen", text: "Magnifique, profite bien !" }],
    });
  });

  it("répond 404 hors du cercle proche, pour un post inconnu, et 400 pour un id mal formé", async () => {
    await db.post.update({ where: { id: POSTS.c2 }, data: { visibility: "closeFriends" } });
    await db.closeFriend.create({ data: { ownerId: USERS.karim, friendId: USERS.lina } });

    expect((await call(post.GET, { as: "alex", params: { id: POSTS.c2 } })).status).toBe(404);
    expect((await call(post.GET, { as: "lina", params: { id: POSTS.c2 } })).status).toBe(200);
    expect((await call(post.GET, { as: "alex", params: { id: "0".repeat(24) } })).status).toBe(404);
    expect((await call(post.GET, { as: "alex", params: { id: "abc" } })).status).toBe(400);
  });
});

describe("/api/posts/[id]/likes", () => {
  const like = (id = POSTS.c1) => call(likes.POST, { as: "alex", params: { id } });

  it("donne une Bonne dose, crédite des points et entame la Sérénité", async () => {
    const res = await like();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ doses: 1249, dosedByMe: true, points: 2455 + POINTS.dose });
    expect(res.body.gains).toEqual([expect.objectContaining({ amount: POINTS.dose, label: "Bonne dose donnée" })]);
    expect(await db.like.count({ where: { userId: USERS.alex } })).toBe(1);
  });

  it("est idempotent : la deuxième dose ne compte pas", async () => {
    await like();

    const res = await like();

    expect(res.body).toMatchObject({ doses: 1249, dosedByMe: true, gains: [], points: 2455 + POINTS.dose });
  });

  it("retire la dose avec DELETE", async () => {
    await like();

    const res = await call(likes.DELETE, { as: "alex", method: "DELETE", params: { id: POSTS.c1 } });

    expect(res.body).toEqual({ doses: 1248, dosedByMe: false });
  });

  it("fonctionne sur les posts du Flow", async () => {
    const res = await like(POSTS.f3);

    expect(res.body).toMatchObject({ doses: 120 + ((3 * 389) % 4800) + 1, dosedByMe: true });
  });

  it("répond 404 pour un post inconnu et 400 pour un id mal formé", async () => {
    expect((await like("0".repeat(24))).body).toEqual(apiError("NOT_FOUND", "Post introuvable."));
    expect((await like("../c1")).body).toEqual(apiError("INVALID_INPUT", "Post invalide"));
  });
});

describe("/api/posts/[id]/saves", () => {
  it("ajoute puis retire un favori", async () => {
    const saved = await call(saves.POST, { as: "alex", params: { id: POSTS.c1 } });
    const again = await call(saves.POST, { as: "alex", params: { id: POSTS.c1 } });
    const removed = await call(saves.DELETE, { as: "alex", method: "DELETE", params: { id: POSTS.c1 } });

    expect(saved.body).toEqual({ savedByMe: true });
    expect(again.body).toEqual({ savedByMe: true });
    expect(removed.body).toEqual({ savedByMe: false });
    expect((await call(posts.GET, { as: "alex", query: { saved: "1" } })).body.items).toEqual([]);
  });

  it("répond 404 pour un post inconnu", async () => {
    const res = await call(saves.POST, { as: "alex", params: { id: "0".repeat(24) } });

    expect(res.status).toBe(404);
  });
});

describe("/api/posts/[id]/comments", () => {
  const comment = (text: unknown, id = POSTS.c1) => call(comments.POST, { as: "alex", params: { id }, body: { text } });

  it("liste les commentaires d'un post", async () => {
    const res = await call(comments.GET, { as: "alex", params: { id: POSTS.c1 } });

    expect(res.body).toEqual({ items: [{ author: "karim.zen", text: "Magnifique, profite bien !" }] });
  });

  it("ajoute un commentaire signé du compte connecté, compte-le et crédite une réaction", async () => {
    const res = await comment("  Inspirant.  ");

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ comment: { author: "alex.detox", text: "Inspirant." }, points: 2455 + POINTS.reaction });
    expect(res.body.gains).toEqual([expect.objectContaining({ amount: POINTS.reaction, label: "Réaction" })]);
    const list = await call(comments.GET, { as: "alex", params: { id: POSTS.c1 } });
    expect(list.body.items.at(-1)).toEqual({ author: "alex.detox", text: "Inspirant." });
    expect((await db.post.findUniqueOrThrow({ where: { id: POSTS.c1 } })).commentsCount).toBe(2);
  });

  it.each([
    ["vide", "   ", `Commentaire : 1 à ${COMMENT_MAX} caractères.`],
    ["trop long", "x".repeat(COMMENT_MAX + 1), `Commentaire : 1 à ${COMMENT_MAX} caractères.`],
    ["qui n'est pas une chaîne", 42, "Champ « text » : string attendu."],
  ])("refuse un commentaire %s", async (_, text, message) => {
    const res = await comment(text);

    expect(res.status).toBe(400);
    expect(res.body).toEqual(apiError("INVALID_INPUT", message));
  });

  it("répond 404 sur un post inconnu", async () => {
    const res = await comment("Coucou", "0".repeat(24));

    expect(res.status).toBe(404);
  });
});
