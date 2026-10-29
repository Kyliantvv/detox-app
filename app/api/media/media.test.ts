import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiError, call } from "@/test/api";
import { db } from "@/lib/db";
import { USERS } from "@/test/db";
import * as posts from "../posts/route";
import { GET } from "./[id]/route";

// auth() lit le cookie via next/headers, indisponible hors d'une vraie requête Next :
// on simule directement la session NextAuth.
const session = vi.hoisted(() => ({ current: null as Session | null }));
vi.mock("@/auth", () => ({ auth: () => Promise.resolve(session.current) }));

const BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

async function publish(as = "alex") {
  const form = new FormData();
  form.set("media", new File([BYTES], "photo.png", { type: "image/png" }));
  const { body } = await call(posts.POST, { as, body: form });
  return (body.post.imageUrl as string).split("/").at(-1)!;
}

describe("GET /api/media/[id]", () => {
  beforeEach(() => {
    session.current = null;
  });

  it("sert le média avec un Bearer", async () => {
    const id = await publish();

    const { status, response } = await call(GET, { as: "lina", params: { id } });

    expect(status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, max-age=86400");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);
  });

  it("sert le média avec le seul cookie de session, comme une balise <img>", async () => {
    const id = await publish();
    session.current = { user: { id: USERS.lina, email: "lina@detox.test", username: "lina.m" }, accessToken: "", expires: "" };

    const res = await call(GET, { params: { id } });

    expect(res.status).toBe(200);
  });

  it("refuse sans session ni Bearer", async () => {
    const id = await publish();

    const res = await call(GET, { params: { id } });

    expect(res.status).toBe(401);
    expect(res.body).toEqual(apiError("UNAUTHORIZED"));
  });

  it("cache le média d'un post réservé au cercle proche", async () => {
    const id = await publish("karim");
    await db.post.updateMany({ where: { mediaPath: `/api/media/${id}` }, data: { visibility: "closeFriends" } });
    await db.closeFriend.create({ data: { ownerId: USERS.karim, friendId: USERS.lina } });

    expect((await call(GET, { as: "alex", params: { id } })).body).toEqual(apiError("NOT_FOUND", "Média introuvable."));
    expect((await call(GET, { as: "lina", params: { id } })).status).toBe(200);
    expect((await call(GET, { as: "karim", params: { id } })).status).toBe(200);
  });

  it("sert un ancien média hors liste blanche en téléchargement", async () => {
    const id = await publish();
    await db.media.update({ where: { id }, data: { mime: "image/svg+xml" } });

    const { response } = await call(GET, { as: "alex", params: { id } });

    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("content-disposition")).toBe("attachment");
  });

  it("répond 404 pour un média inconnu et 400 pour un id mal formé", async () => {
    expect((await call(GET, { as: "alex", params: { id: "0".repeat(24) } })).body).toEqual(
      apiError("NOT_FOUND", "Média introuvable."),
    );
    expect((await call(GET, { as: "alex", params: { id: "a/b" } })).status).toBe(400);
  });
});
