// Câblage de la route sur lib/upload-router.ts (ses règles sont testées dans lib/upload-router.test.ts).
// Le stockage UploadThing est remplacé par l'adaptateur mémoire de files-sdk.
import { createFilesClient } from "files-sdk/client";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { getFiles } from "@/lib/files";
import * as route from "./route";

vi.mock("@/lib/files", async () => {
  const { createFiles } = await import("files-sdk");
  const { memory } = await import("files-sdk/memory");
  const files = createFiles({ adapter: memory() });
  return { getFiles: vi.fn(() => files) };
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const post = (body: unknown) =>
  route.POST(new Request("http://localhost/api/files", { method: "POST", body: JSON.stringify(body) }));

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

    await fresh.POST(new Request("http://localhost/api/files", { method: "POST", body: '{"op":"presign","files":[]}' }));

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

  it("stocke une image envoyée par le client files-sdk", async () => {
    const handlers: Record<string, (req: Request) => Promise<Response>> = route;
    const client = createFilesClient({
      endpoint: "http://localhost/api/files",
      fetchImpl: ((input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        return handlers[request.method](request);
      }) as typeof fetch,
    });

    const { key } = await client.upload(new File([PNG], "photo.png", { type: "image/png" }));

    const { items } = await getFiles().list();
    expect(items.map((item) => item.key)).toEqual([key]);
  });
});
