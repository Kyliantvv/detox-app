import { describe, expect, it } from "vitest";
import { POINTS } from "@/lib/game";
import { EXPLORE_TILES } from "@/lib/server/seed";
import { accountOf, db } from "@/lib/server/db";
import { CAPTION_MAX, COMMENT_MAX } from "@/lib/validation";
import { apiError, call } from "@/test/api";
import * as circle from "../feed/circle/route";
import * as comments from "./[id]/comments/route";
import * as likes from "./[id]/likes/route";
import * as saves from "./[id]/saves/route";
import * as posts from "./route";

const ids = (items: { id: string }[]) => items.map((item) => item.id);

const upload = (fields: Record<string, string | File>) => {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
};
const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "photo.png", { type: "image/png" });

describe("GET /api/posts", () => {
  it("renvoie la mosaïque d'exploration", async () => {
    const res = await call(posts.GET, { as: "alex", query: { explore: "1" } });

    expect(res.body).toEqual({ items: EXPLORE_TILES });
  });

  it.each(["lina", "lina.m", "LINA.M"])("filtre par auteur (%s)", async (author) => {
    const res = await call(posts.GET, { as: "alex", query: { author } });

    expect(ids(res.body.items).sort()).toEqual(["c1", "r2"]);
  });

  it("répond 404 pour un auteur inconnu", async () => {
    const res = await call(posts.GET, { as: "alex", query: { author: "personne" } });

    expect(res.status).toBe(404);
    expect(res.body).toEqual(apiError("NOT_FOUND", "Auteur introuvable."));
  });

  it.each([
    ["reel", ["r1", "r2", "r3", "r4"]],
    ["post", ["c1", "c2", "c3", "c4"]],
  ])("filtre par type=%s", async (type, expected) => {
    const res = await call(posts.GET, { as: "alex", query: { type } });

    expect(ids(res.body.items).sort()).toEqual(expected);
  });

  it("refuse un type inconnu", async () => {
    const res = await call(posts.GET, { as: "alex", query: { type: "story" } });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(apiError("INVALID_INPUT", "type doit valoir reel ou post."));
  });

  it("retrouve les favoris, y compris les posts du Flow qui ne sont pas stockés", async () => {
    await call(saves.POST, { as: "alex", params: { id: "f7" } });
    await call(saves.POST, { as: "alex", params: { id: "c2" } });
    await call(saves.POST, { as: "lina", params: { id: "c3" } });

    const res = await call(posts.GET, { as: "alex", query: { saved: "1" } });

    expect(ids(res.body.items).sort()).toEqual(["c2", "f7"]);
    expect(res.body.items.every((post: { savedByMe: boolean }) => post.savedByMe)).toBe(true);
  });
});

describe("POST /api/posts", () => {
  it("publie une image, la sert depuis /api/media et crédite la publication", async () => {
    const res = await call(posts.POST, { as: "alex", body: upload({ media: png(), caption: "  Vue sur mon écran.  " }) });

    expect(res.status).toBe(201);
    expect(res.body.post).toMatchObject({
      authorId: "alex",
      caption: "Vue sur mon écran.",
      isReel: false,
      doses: 0,
      imageUrl: expect.stringMatching(/^\/api\/media\/\w+$/),
    });
    expect(res.body.post.videoUrl).toBeUndefined();
    expect(res.body.gains).toEqual([expect.objectContaining({ amount: POINTS.reaction, label: "Publication" })]);
    expect(res.body.points).toBe(2455 + POINTS.reaction);
  });

  it("publie une vidéo comme reel", async () => {
    const video = new File([new Uint8Array(8)], "clip.mp4", { type: "video/mp4" });

    const res = await call(posts.POST, { as: "alex", body: upload({ media: video }) });

    expect(res.body.post).toMatchObject({ isReel: true, caption: "", videoUrl: expect.stringMatching(/^\/api\/media\//) });
  });

  it("fait apparaître le post dans le cercle de son auteur", async () => {
    const { body } = await call(posts.POST, { as: "alex", body: upload({ media: png() }) });

    const res = await call(circle.GET, { as: "alex" });

    expect(res.body.items[0].id).toBe(body.post.id);
  });

  it.each([
    ["sans média", upload({ caption: "légende" }), "Champ « media » : image ou vidéo attendue."],
    ["un média texte", upload({ media: new File(["hello"], "a.txt", { type: "text/plain" }) }), "Champ « media » : image ou vidéo attendue."],
    ["un média en texte brut", upload({ media: "pas un fichier" }), "Champ « media » : image ou vidéo attendue."],
    ["une légende trop longue", upload({ media: png(), caption: "x".repeat(CAPTION_MAX + 1) }), `Légende : ${CAPTION_MAX} caractères maximum.`],
    ["un champ inconnu", upload({ media: png(), authorId: "lina" }), "Champ(s) inconnu(s) : authorId."],
    ["un corps JSON", JSON.stringify({ caption: "x" }), "Corps multipart/form-data attendu."],
  ])("refuse %s", async (_, body, message) => {
    const before = db().posts.size;

    const res = await call(posts.POST, { as: "alex", body });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(apiError("INVALID_INPUT", message));
    expect(db().posts.size).toBe(before);
    expect(accountOf("alex").points).toBe(2455);
  });

  it("refuse un fichier de plus de 20 Mo", async () => {
    const big = new File([new Uint8Array(20 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });

    const res = await call(posts.POST, { as: "alex", body: upload({ media: big }) });

    expect(res.body).toEqual(apiError("INVALID_INPUT", "Fichier trop lourd (20 Mo max)."));
  });
});

describe("/api/posts/[id]/likes", () => {
  const like = (id = "c1") => call(likes.POST, { as: "alex", params: { id } });

  it("donne une Bonne dose et crédite des points", async () => {
    const res = await like();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ doses: 1249, dosedByMe: true, points: 2455 + POINTS.dose });
    expect(res.body.gains).toEqual([expect.objectContaining({ amount: POINTS.dose, label: "Bonne dose donnée" })]);
    expect(accountOf("alex").serenity).toBe(99);
  });

  it("est idempotent : la deuxième dose ne compte pas", async () => {
    await like();

    const res = await like();

    expect(res.body).toMatchObject({ doses: 1249, dosedByMe: true, gains: [], points: 2455 + POINTS.dose });
  });

  it("retire la dose avec DELETE", async () => {
    await like();

    const res = await call(likes.DELETE, { as: "alex", method: "DELETE", params: { id: "c1" } });

    expect(res.body).toEqual({ doses: 1248, dosedByMe: false });
  });

  it("fonctionne sur les posts du Flow, régénérés à la volée", async () => {
    const res = await like("f3");

    expect(res.body).toMatchObject({ doses: 120 + ((3 * 389) % 4800) + 1, dosedByMe: true });
  });

  it("répond 404 pour un post inconnu et 400 pour un id mal formé", async () => {
    expect((await like("zzz")).body).toEqual(apiError("NOT_FOUND", "Post introuvable."));
    expect((await like("../c1")).body).toEqual(apiError("INVALID_INPUT", "id mal formé."));
  });
});

describe("/api/posts/[id]/saves", () => {
  it("ajoute puis retire un favori", async () => {
    const saved = await call(saves.POST, { as: "alex", params: { id: "c1" } });
    const removed = await call(saves.DELETE, { as: "alex", method: "DELETE", params: { id: "c1" } });

    expect(saved.body).toEqual({ savedByMe: true });
    expect(removed.body).toEqual({ savedByMe: false });
    expect((await call(posts.GET, { as: "alex", query: { saved: "1" } })).body.items).toEqual([]);
  });

  it("répond 404 pour un post inconnu", async () => {
    const res = await call(saves.POST, { as: "alex", params: { id: "zzz" } });

    expect(res.status).toBe(404);
  });
});

describe("/api/posts/[id]/comments", () => {
  const comment = (text: unknown, id = "c1") => call(comments.POST, { as: "alex", params: { id }, body: { text } });

  it("liste les commentaires d'un post", async () => {
    const res = await call(comments.GET, { as: "alex", params: { id: "c1" } });

    expect(res.body).toEqual({ items: [{ author: "karim.zen", text: "Pareil, j'ai oublié de dormir." }] });
  });

  it("ajoute un commentaire signé du compte connecté et crédite une réaction", async () => {
    const res = await comment("  Inspirant.  ");

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ comment: { author: "alex.detox", text: "Inspirant." }, points: 2455 + POINTS.reaction });
    expect(res.body.gains).toEqual([expect.objectContaining({ amount: POINTS.reaction, label: "Réaction" })]);
    const list = await call(comments.GET, { as: "alex", params: { id: "c1" } });
    expect(list.body.items.at(-1)).toEqual({ author: "alex.detox", text: "Inspirant." });
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
    const res = await comment("Coucou", "zzz");

    expect(res.status).toBe(404);
  });
});
