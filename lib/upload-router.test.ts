import { describe, expect, it } from "vitest";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { createFiles, type FileInfo } from "files-sdk";
import { createFilesClient } from "files-sdk/client";
import { memory } from "files-sdk/memory";
import request from "supertest";
import { MAX_UPLOAD_SIZE } from "./media-types";
import { createUploadRouter } from "./upload-router";

// Stands in for the API's Bearer check: "Bearer <user id>".
const AUTH = { authorization: "Bearer alex" };
const authenticate = (req: Request) =>
  Promise.resolve(req.headers.get("authorization")?.replace(/^Bearer /, "") || null);

const setup = () => {
  const files = createFiles({ adapter: memory() });
  const uploads: { file: FileInfo; ownerId: string }[] = [];
  const router = createUploadRouter(files, {
    secret: "test-secret",
    authenticate,
    onUpload: (file, ownerId) => Promise.resolve(void uploads.push({ file, ownerId })),
  });

  // Node server around the Web-standard handler, for Supertest. A fixed origin
  // keeps upload tokens valid across requests (Supertest picks a new port
  // for each), and headers are copied pair by pair to keep repeated ones.
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const headers = new Headers();
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      headers.append(req.rawHeaders[i], req.rawHeaders[i + 1]);
    }
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const response = await router.handle(
      new Request(new URL(req.url ?? "/", "http://localhost"), {
        method: req.method,
        headers,
        body: hasBody ? Buffer.concat(chunks) : undefined,
      }),
    );
    response.headers.forEach((value, name) => {
      if (name !== "set-cookie") res.setHeader(name, value);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) res.setHeader("set-cookie", cookies);
    res.writeHead(response.status);
    res.end(Buffer.from(await response.arrayBuffer()));
  };
  const server = createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      res.writeHead(500).end(String(error));
    });
  });

  // The upload protocol is three requests; let the SDK client drive it.
  const client = createFilesClient({
    endpoint: "http://localhost/api/files",
    headers: AUTH,
    fetchImpl: ((input: RequestInfo | URL, init?: RequestInit) =>
      router.handle(new Request(input, init))) as typeof fetch,
  });

  return { files, server, client, uploads };
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const pngBytes = (size = 16) => {
  const bytes = new Uint8Array(size);
  bytes.set(PNG_SIGNATURE);
  return bytes;
};

const image = (size = 16, name = "photo.png", type = "image/png") =>
  new File([pngBytes(size)], name, { type });

// An MP4 starts with an `ftyp` box: size, "ftyp", brand.
const mp4 = () =>
  new File([new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode("ftypisom"), 0, 0, 0, 0])], "clip.mp4", {
    type: "video/mp4",
  });

type Presigned = { id: string; key: string; target: { url: string } };

// First step of the upload protocol, done by hand to send the PUT ourselves.
const presign = async (
  server: Server,
  file: { name: string; type: string; size?: number },
) => {
  const res = await request(server)
    .post("/")
    .set(AUTH)
    .send({ op: "presign", files: [file] });
  const [upload] = (res.body as { uploads: Presigned[] }).uploads;
  const { pathname, search } = new URL(upload.target.url);
  return { id: upload.id, key: upload.key, path: pathname + search };
};

describe("POST /api/files", () => {
  it("answers capabilities", async () => {
    const { server } = setup();

    const res = await request(server).post("/").set(AUTH).send({ op: "capabilities" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("capabilities");
  });

  it.each([
    ["list", { op: "list" }],
    ["delete", { op: "delete", key: "x.png" }],
    ["head", { op: "head", key: "x.png" }],
    ["url", { op: "url", key: "x.png" }],
  ])("refuses %s with 403", async (op, body) => {
    const { server } = setup();

    const res = await request(server).post("/").set(AUTH).send(body);

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

  it("hands each verified upload to onUpload with its owner", async () => {
    const { client, uploads } = setup();

    const { key } = await client.upload(image());

    expect(uploads).toEqual([
      { file: expect.objectContaining({ key, contentType: "image/png", size: 16 }), ownerId: "alex" },
    ]);
  });

  it("accepts videos", async () => {
    const { client, uploads } = setup();

    const { key } = await client.upload(mp4());

    expect(key).toMatch(/\.mp4$/);
    expect(uploads[0].file.contentType).toBe("video/mp4");
  });

  it("refuses a presign without a Bearer", async () => {
    const { files, server } = setup();

    const res = await request(server)
      .post("/")
      .send({ op: "presign", files: [{ name: "photo.png", type: "image/png" }] });

    expect(res.status).toBe(401);
    expect((await files.list()).items).toEqual([]);
  });

  it("refuses a complete without a Bearer", async () => {
    const { server, uploads } = setup();
    const { id, key, path } = await presign(server, { name: "photo.png", type: "image/png" });
    await request(server).put(path).set("content-type", "image/png").send(Buffer.from(pngBytes()));

    const res = await request(server)
      .post("/")
      .send({ op: "complete", completions: [{ id, key }] });

    expect(res.status).toBe(401);
    expect(uploads).toEqual([]);
  });

  it("rejects uploads over the size cap", async () => {
    const { client } = setup();

    await expect(client.upload(image(MAX_UPLOAD_SIZE + 1))).rejects.toMatchObject({
      code: "Invalid",
      message: "upload exceeds maxUploadSize",
    });
  });

  it.each([
    ["text", "notes.txt", "text/plain"],
    // SVG can carry scripts, and uploads are served inline.
    ["SVG", "logo.svg", "image/svg+xml"],
  ])("refuses %s files", async (_, name, type) => {
    const { client } = setup();

    await expect(client.upload(image(16, name, type))).rejects.toMatchObject({
      code: "Invalid",
      message: "only images and videos can be uploaded",
    });
  });

  it("refuses a missing type", async () => {
    const { files, server } = setup();

    const res = await request(server)
      .post("/")
      .set(AUTH)
      .send({ op: "presign", files: [{ name: "photo.png", type: "" }] });

    expect(res.status).toBe(422);
    expect((await files.list()).items).toEqual([]);
  });

  it("refuses content that doesn't match the declared type", async () => {
    const { files, client } = setup();
    const svg = new File(["<svg onload='alert(1)'/>"], "photo.png", {
      type: "image/png",
    });

    await expect(client.upload(svg)).rejects.toMatchObject({
      code: "Invalid",
      message: "file content is not the declared type",
    });
    expect((await files.list()).items).toEqual([]);
  });

  it("stores the declared type, not the PUT's content-type", async () => {
    const { files, server } = setup();
    const { key, path } = await presign(server, {
      name: "photo.png",
      type: "image/png",
    });

    const res = await request(server)
      .put(path)
      .set("content-type", "image/svg+xml")
      .send(Buffer.from(pngBytes()));

    expect(res.status).toBe(200);
    expect((await files.head(key)).contentType).toBe("image/png");
  });

  it.each([
    ["a small declared size", { size: 16 }],
    ["no declared size", {}],
  ])("refuses a body over the cap with %s", async (_, declared) => {
    const { files, server } = setup();
    const { path } = await presign(server, {
      name: "photo.png",
      type: "image/png",
      ...declared,
    });

    const res = await request(server)
      .put(path)
      .set("content-type", "image/png")
      .send(Buffer.from(pngBytes(MAX_UPLOAD_SIZE + 1)));

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: { code: "Validation", reason: "size" } });
    expect((await files.list()).items).toEqual([]);
  });

  it("refuses a client-chosen key", async () => {
    const { files, server } = setup();

    const res = await request(server)
      .put("/?op=upload&key=photo.png")
      .set(AUTH)
      .set("content-type", "image/png")
      .send(Buffer.from(pngBytes()));

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      error: { code: "Validation", message: "uploads can't choose their key" },
    });
    expect((await files.list()).items).toEqual([]);
  });
});
