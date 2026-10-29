import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { getFiles } from "@/lib/files";
import { registerAccount } from "@/lib/server/accounts";
import { AUTO_REPLIES } from "@/lib/server/content";
import { MESSAGE_MAX, MESSAGE_MEDIA_MAX } from "@/lib/validation";
import { advanceTime, apiError, call, freezeTime } from "@/test/api";
import { USERS } from "@/test/db";
import * as thread from "./[id]/messages/route";
import { GET } from "./route";

type Item = { id: string; unread: boolean; preview: string };

const list = async (as = "alex") => (await call(GET, { as })).body.items as Item[];
const { alex, lina, karim, ines, noah } = USERS;
const read = (id: string, as = "alex") => call(thread.GET, { as, params: { id } });
const send = (id: string, text: unknown, as = "alex") => call(thread.POST, { as, params: { id }, body: { text } });

// Le stockage UploadThing est remplacé par l'adaptateur mémoire de files-sdk.
vi.mock("@/lib/files", async () => {
  const { createFiles } = await import("files-sdk");
  const { memory } = await import("files-sdk/memory");
  const files = createFiles({ adapter: memory() });
  return { getFiles: () => files };
});

// Ce que laisse un envoi par /api/files : le fichier stocké et sa ligne `media`.
async function uploaded(who: keyof typeof USERS, mime = "image/png") {
  const key = `${randomUUID()}.${mime.split("/")[1]}`;
  await getFiles().upload(key, new Uint8Array(8), { contentType: mime });
  await db.media.create({ data: { key, ownerId: USERS[who], mime, size: 8, usedAt: null } });
  return key;
}

describe("GET /api/conversations", () => {
  it("amorce les fils des comptes seedés qui ont des messages de départ", async () => {
    freezeTime();

    const items = await list();

    expect(items.map((item) => item.id).sort()).toEqual([ines, karim, lina, noah].sort());
    expect(items.find((item) => item.id === karim)).toEqual({
      id: karim,
      user: { id: karim, username: "karim.zen", name: "Karim" },
      preview: "T'as vu mon ticket ? +200 ×2 encore",
      fromMe: false,
      ago: "il y a 1 min",
      at: Date.now() - 60_000,
      unread: true,
    });
  });

  it("marque un fil comme lu une fois ouvert", async () => {
    await read(karim);

    const items = await list();

    expect(items.find((item) => item.id === karim)?.unread).toBe(false);
    expect(items.find((item) => item.id === lina)?.unread).toBe(true);
  });

  it("remonte en tête le fil du dernier message", async () => {
    freezeTime();
    await list();

    advanceTime(1000);
    await send(noah, "Ma série : 0 jour.");

    expect((await list())[0]).toMatchObject({ id: noah, preview: "Ma série : 0 jour.", unread: false });
  });
});

describe("/api/conversations/[id]/messages", () => {
  it("renvoie le fil avec le profil de l'autre compte", async () => {
    const res = await read(lina);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: lina, username: "lina.m", followedByMe: true });
    expect(res.body.items.map(({ from, text }: { from: string; text: string }) => ({ from, text }))).toEqual([
      { from: "me", text: "Tu viens ce soir ?" },
      { from: "them", text: "Je fais une pause demain." },
    ]);
  });

  it("envoie un message et n'affiche la réponse automatique qu'après son délai", async () => {
    freezeTime();

    const res = await send(lina, "  On se voit ?  ");

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: { id: expect.any(String), from: "me", text: "On se voit ?", at: Date.now() } });
    expect((await read(lina)).body.items.at(-1)).toMatchObject({ from: "me", text: "On se voit ?" });

    advanceTime(1400);
    const reply = (await read(lina)).body.items.at(-1);
    expect(reply.from).toBe("them");
    expect(AUTO_REPLIES).toContain(reply.text);
  });

  it("signale la réponse automatique comme non lue", async () => {
    freezeTime();
    await send(lina, "Coucou");
    await read(lina);

    advanceTime(1400);

    expect((await list()).find((item) => item.id === lina)?.unread).toBe(true);
  });

  it("amorce le fil une seule fois, même lu deux fois en même temps", async () => {
    await Promise.all([read(lina), read(lina)]);

    expect((await read(lina)).body.items).toHaveLength(2);
  });

  it("ne fait pas répondre les vrais comptes, qui voient le message chez eux", async () => {
    freezeTime();
    const bob = (await registerAccount({ email: "bob@example.com", username: "bob", password: "secret1" })).user;

    await send(bob.id, "Salut Bob");
    advanceTime(60_000);

    expect((await read(bob.id)).body.items).toHaveLength(1);
    const fromAlex = (await list(bob.id)).find((item) => item.id === alex);
    expect(fromAlex).toMatchObject({ preview: "Salut Bob", unread: true });
    expect((await read(alex, bob.id)).body.items).toEqual([expect.objectContaining({ from: "them", text: "Salut Bob" })]);
  });

  it("envoie une photo seule, montrée en aperçu « Photo » dans la liste", async () => {
    const bob = (await registerAccount({ email: "bob@example.com", username: "bob", password: "secret1" })).user;
    const mediaKey = await uploaded("alex");
    const url = await getFiles().url(mediaKey);

    const res = await call(thread.POST, { as: "alex", params: { id: bob.id }, body: { mediaKeys: [mediaKey] } });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatchObject({ from: "me", text: "", media: [{ url, mime: "image/png" }] });
    expect((await read(bob.id)).body.items.at(-1)).toMatchObject({ text: "", media: [{ url, mime: "image/png" }] });
    expect((await list()).find((item) => item.id === bob.id)).toMatchObject({ preview: "📷 Photo" });
  });

  it("envoie une vidéo avec un texte, et le texte sert d'aperçu", async () => {
    const bob = (await registerAccount({ email: "bob@example.com", username: "bob", password: "secret1" })).user;
    const mediaKey = await uploaded("alex", "video/mp4");

    const res = await call(thread.POST, { as: "alex", params: { id: bob.id }, body: { text: "Regarde 😂", mediaKeys: [mediaKey] } });

    expect(res.body.message).toMatchObject({ text: "Regarde 😂", media: [{ mime: "video/mp4" }] });
    expect((await list()).find((item) => item.id === bob.id)).toMatchObject({ preview: "Regarde 😂" });
  });

  it("refuse un média d'un autre compte ou déjà envoyé", async () => {
    const theirs = await uploaded("lina");
    const mine = await uploaded("alex");
    await call(thread.POST, { as: "alex", params: { id: karim }, body: { mediaKeys: [mine] } });

    for (const mediaKey of [theirs, mine]) {
      const res = await call(thread.POST, { as: "alex", params: { id: karim }, body: { mediaKeys: [mediaKey] } });
      expect(res.status).toBe(404);
      expect(res.body).toEqual(apiError("NOT_FOUND", "Média introuvable ou déjà publié."));
    }
  });

  it("envoie plusieurs photos et vidéos dans l'ordre choisi", async () => {
    const bob = (await registerAccount({ email: "bob@example.com", username: "bob", password: "secret1" })).user;
    const photos = [await uploaded("alex"), await uploaded("alex", "image/jpeg")];

    const res = await call(thread.POST, { as: "alex", params: { id: bob.id }, body: { mediaKeys: photos } });

    expect(res.status).toBe(201);
    expect(res.body.message.media).toEqual([
      { url: await getFiles().url(photos[0]), mime: "image/png" },
      { url: await getFiles().url(photos[1]), mime: "image/jpeg" },
    ]);
    expect((await list()).find((item) => item.id === bob.id)).toMatchObject({ preview: "📷 2 photos" });

    const mixed = [await uploaded("alex"), await uploaded("alex", "video/mp4")];
    await call(thread.POST, { as: "alex", params: { id: bob.id }, body: { mediaKeys: mixed } });
    expect((await list()).find((item) => item.id === bob.id)).toMatchObject({ preview: "📷 2 médias" });
  });

  it("n'envoie rien si un des médias est refusé", async () => {
    const mine = await uploaded("alex");
    const theirs = await uploaded("lina");

    const res = await call(thread.POST, { as: "alex", params: { id: karim }, body: { mediaKeys: [mine, theirs] } });

    expect(res.status).toBe(404);
    expect(await db.media.findUnique({ where: { key: mine } })).toMatchObject({ usedAt: null });
  });

  it("envoie un message vocal seul, montré en aperçu « Message vocal »", async () => {
    const bob = (await registerAccount({ email: "bob@example.com", username: "bob", password: "secret1" })).user;
    const voice = await uploaded("alex", "audio/webm");

    const res = await call(thread.POST, { as: "alex", params: { id: bob.id }, body: { mediaKeys: [voice] } });

    expect(res.body.message).toMatchObject({ text: "", media: [{ mime: "audio/webm" }] });
    expect((await list()).find((item) => item.id === bob.id)).toMatchObject({ preview: "🎤 Message vocal" });
  });

  it.each([
    ["onze médias", async () => ({ mediaKeys: Array.from({ length: MESSAGE_MEDIA_MAX + 1 }, (_, i) => `${i}.png`) }), `${MESSAGE_MEDIA_MAX} photos ou vidéos maximum par message.`],
    ["un message vocal avec une photo", async () => ({ mediaKeys: [await uploaded("alex", "audio/ogg"), await uploaded("alex")] }), "Un message vocal part seul."],
    ["deux fois le même média", async () => ({ mediaKeys: ["a.png", "a.png"] }), "Un même média est joint deux fois."],
    ["des médias qui ne sont pas une liste", async () => ({ mediaKeys: "a.png" }), "Champ « mediaKeys » : liste de chaînes attendue."],
  ])("refuse %s", async (_, body, message) => {
    const res = await call(thread.POST, { as: "alex", params: { id: karim }, body: await body() });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(apiError("INVALID_INPUT", message));
  });

  it.each([
    ["vide", "   ", `Message : 1 à ${MESSAGE_MAX} caractères.`],
    ["trop long", "x".repeat(MESSAGE_MAX + 1), `Message : 1 à ${MESSAGE_MAX} caractères.`],
    ["qui n'est pas une chaîne", null, "Champ « text » : string attendu."],
  ])("refuse un message %s", async (_, text, message) => {
    const res = await send(lina, text);

    expect(res.status).toBe(400);
    expect(res.body).toEqual(apiError("INVALID_INPUT", message));
  });

  it.each([
    ["à soi-même", USERS.alex, 404, apiError("NOT_FOUND", "Conversation introuvable.")],
    ["à un compte inconnu", "0".repeat(24), 404, apiError("NOT_FOUND", "Conversation introuvable.")],
    ["avec un id mal formé", "../lina", 400, apiError("INVALID_INPUT", "Conversation invalide")],
  ])("refuse d'écrire %s", async (_, id, status, error) => {
    const res = await send(id, "Coucou");

    expect(res.status).toBe(status);
    expect(res.body).toEqual(error);
  });
});
