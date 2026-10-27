import { FilesError, type Files } from "files-sdk";
import type { ImageType } from "./image-types";

type Body = Parameters<Files["upload"]>[1];

const ascii = (bytes: Uint8Array, at: number, text: string) =>
  [...text].every((char, i) => bytes[at + i] === char.charCodeAt(0));

// Magic bytes for each allowed type. The Record type makes adding a type to
// IMAGE_TYPES without a signature a type error.
const SIGNATURES: Record<ImageType, (head: Uint8Array) => boolean> = {
  "image/avif": (b) =>
    ascii(b, 4, "ftyp") && (ascii(b, 8, "avif") || ascii(b, 8, "avis")),
  "image/gif": (b) => ascii(b, 0, "GIF87a") || ascii(b, 0, "GIF89a"),
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) =>
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x),
  "image/webp": (b) => ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP"),
};

const HEAD_SIZE = 12;

/**
 * Checks that an upload's first bytes match its content type, and returns a
 * stream that still yields the whole body. The type declared at presign is
 * only the client's word; this checks what is actually stored.
 */
export const checkImageSignature = async (
  body: Body,
  contentType: string | undefined,
): Promise<ReadableStream<Uint8Array>> => {
  const stream =
    body instanceof ReadableStream ? body : new Response(body as BodyInit).body;
  if (!stream) throw new FilesError("Invalid", "upload is empty");

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (length < HEAD_SIZE) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    length += value.length;
  }
  const head = new Uint8Array(length);
  chunks.reduce((offset, chunk) => (head.set(chunk, offset), offset + chunk.length), 0);

  const matches = SIGNATURES[contentType as ImageType] as
    | ((head: Uint8Array) => boolean)
    | undefined;
  if (!matches?.(head)) {
    await reader.cancel();
    throw new FilesError("Invalid", "file content is not the declared image type");
  }

  return new ReadableStream({
    start: (controller) => controller.enqueue(head),
    pull: async (controller) => {
      const { done, value } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel: (reason) => reader.cancel(reason),
  });
};

/** Wraps a Files instance so every upload goes through checkImageSignature. */
export const withImageCheck = (files: Files): Files =>
  new Proxy(files, {
    get(target, prop) {
      if (prop === "upload") {
        return async (
          key: string | unknown[],
          body: Body,
          opts?: { contentType?: string },
        ) => {
          // The router only uploads one file per call; refuse the batch form
          // rather than let it skip the check.
          if (typeof key !== "string") {
            throw new FilesError("Unsupported", "batch uploads aren't checked");
          }
          return target.upload(
            key,
            await checkImageSignature(body, opts?.contentType),
            opts,
          );
        };
      }
      const value: unknown = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
