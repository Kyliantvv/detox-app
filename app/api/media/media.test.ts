import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiError, call } from "@/test/api";
import * as posts from "../posts/route";
import { GET } from "./[id]/route";

// auth() lit le cookie via next/headers, indisponible hors d'une vraie requête Next :
// on simule directement la session NextAuth.
const session = vi.hoisted(() => ({ current: null as Session | null }));
vi.mock("@/auth", () => ({ auth: () => Promise.resolve(session.current) }));

const BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

async function publish() {
  const form = new FormData();
  form.set("media", new File([BYTES], "photo.png", { type: "image/png" }));
  const { body } = await call(posts.POST, { as: "alex", body: form });
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
    expect(response.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);
  });

  it("sert le média avec le seul cookie de session, comme une balise <img>", async () => {
    const id = await publish();
    session.current = { user: { id: "lina", email: "lina@detox.test", username: "lina.m" }, accessToken: "", expires: "" };

    const res = await call(GET, { params: { id } });

    expect(res.status).toBe(200);
  });

  it("refuse sans session ni Bearer", async () => {
    const id = await publish();

    const res = await call(GET, { params: { id } });

    expect(res.status).toBe(401);
    expect(res.body).toEqual(apiError("UNAUTHORIZED"));
  });

  it("répond 404 pour un média inconnu et 400 pour un id mal formé", async () => {
    expect((await call(GET, { as: "alex", params: { id: "inconnu" } })).body).toEqual(
      apiError("NOT_FOUND", "Média introuvable."),
    );
    expect((await call(GET, { as: "alex", params: { id: "a/b" } })).status).toBe(400);
  });
});
