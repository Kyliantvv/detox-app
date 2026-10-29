// Câblage de la route sur lib/upload-router.ts (ses règles sont testées dans lib/upload-router.test.ts).
// Le stockage UploadThing est remplacé par l'adaptateur mémoire de files-sdk ; le Bearer et
// la collection media sont les vrais.
import { createFilesClient } from "files-sdk/client";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { getFiles } from "@/lib/files";
import { signToken } from "@/lib/server/auth";
import { USERS } from "@/test/db";
import * as route from "./route";

vi.mock("@/lib/files", async () => {
  const { createFiles } = await import("files-sdk");
  const { memory } = await import("files-sdk/memory");
  const files = createFiles({ adapter: memory() });
  return { getFiles: vi.fn(() => files) };
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const AUTH = { authorization: `Bearer ${signToken(USERS.alex)}` };

const post = (body: unknown, headers: Record<string, string> = AUTH) =>
  route.POST(new Request("http://localhost/api/files", { method: "POST", headers, body: JSON.stringify(body) }));

const client = (headers: Record<string, string> = AUTH) => {
  const handlers: Record<string, (req: Request) => Promise<Response>> = route;
  return createFilesClient({
    endpoint: "http://localhost/api/files",
    headers,
    fetchImpl: ((input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      return handlers[request.method](request);
    }) as typeof fetch,
  });
};

describe("/api/files", () => {
  beforeAll(() => {
    // Sans secret, files-sdk en tire un au hasard et prévient sur la console.
    process.env.FILES_API_SECRET = "test-secret";
    return () => {
      delete process.env.FILES_API_SECRET;
    };
  });

  it("ne crée le client de stockage qu'à la première requête", async () => {
    vi.resetModules();
    const files = await import("@/lib/files");
    const fresh = await import("./route");
    expect(files.getFiles).not.toHaveBeenCalled();

    await fresh.POST(
      new Request("http://localhost/api/files", { method: "POST", headers: AUTH, body: '{"op":"presign","files":[]}' }),
    );

    expect(files.getFiles).toHaveBeenCalled();
  });

  it("répond aux capacités", async () => {
    const res = await post({ op: "capabilities" });

    expect(res.status).toBe(200);
  });

  it("refuse de lister les fichiers", async () => {
    const res = await post({ op: "list" });

    expect(res.status).toBe(403);
  });

  it("stocke une image et la lie au compte qui l'envoie", async () => {
    const { key } = await client().upload(new File([PNG], "photo.png", { type: "image/png" }));

    const { items } = await getFiles().list();
    expect(items.map((item) => item.key)).toEqual([key]);
    expect(await db.media.findUnique({ where: { key } })).toMatchObject({
      ownerId: USERS.alex,
      mime: "image/png",
      size: PNG.length,
      usedAt: null,
    });
  });

  it.each([
    ["sans Bearer", {}],
    ["avec un Bearer invalide", { authorization: "Bearer faux" }],
  ])("refuse un envoi %s", async (_, headers) => {
    const res = await post({ op: "presign", files: [{ name: "photo.png", type: "image/png" }] }, headers);

    expect(res.status).toBe(401);
  });
});
