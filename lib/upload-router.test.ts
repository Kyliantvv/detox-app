import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { createFiles } from "files-sdk";
import { createFilesClient } from "files-sdk/client";
import { memory } from "files-sdk/memory";
import request from "supertest";
import { createUploadRouter, MAX_UPLOAD_SIZE } from "./upload-router";

const setup = () => {
  const files = createFiles({ adapter: memory() });
  const router = createUploadRouter(files);

  // Node server around the Web-standard handler, for Supertest.
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const response = await router.handle(
      new Request(`http://${req.headers.host}${req.url}`, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body: hasBody ? Buffer.concat(chunks) : undefined,
      }),
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });

  // The upload protocol is three requests; let the SDK client drive it.
  const client = createFilesClient({
    endpoint: "http://localhost/api/files",
    fetchImpl: ((input: RequestInfo | URL, init?: RequestInit) =>
      router.handle(new Request(input, init))) as typeof fetch,
  });

  return { files, server, client };
};

const image = (size = 4) =>
  new File([new Uint8Array(size)], "photo.png", { type: "image/png" });

describe("POST /api/files", () => {
  it("answers capabilities", async () => {
    const { server } = setup();

    const res = await request(server).post("/").send({ op: "capabilities" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("capabilities");
  });

  it.each([
    ["list", { op: "list" }],
    ["delete", { op: "delete", key: "x.png" }],
  ])("refuses %s with 403", async (op, body) => {
    const { server } = setup();

    const res = await request(server).post("/").send(body);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: {
        code: "Forbidden",
        message: `operation not allowed: ${op}`,
        reason: "forbidden",
      },
    });
  });
});

describe("upload", () => {
  it("stores uploads under a key without a slash", async () => {
    const { files, client } = setup();

    const { key } = await client.upload(image());

    // Check the stored key, not the returned one: the gateway strips any
    // keyPrefix from responses, so a reintroduced prefix would hide there.
    const { items } = await files.list();
    expect(items.map((item) => item.key)).toEqual([key]);
    expect(key).not.toContain("/");
    expect(key).toMatch(/\.png$/);
  });

  it("returns a URL for an uploaded file", async () => {
    const { client } = setup();
    const { key } = await client.upload(image());

    await expect(client.url(key)).resolves.toEqual(expect.any(String));
  });

  it("rejects uploads over the size cap", async () => {
    const { client } = setup();

    await expect(client.upload(image(MAX_UPLOAD_SIZE + 1))).rejects.toMatchObject({
      code: "Invalid",
      message: "upload exceeds maxUploadSize",
    });
  });
});
