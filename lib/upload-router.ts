import { FilesError, type FileInfo, type Files } from "files-sdk";
import { createFilesRouter } from "files-sdk/api";
import { withSignatureCheck } from "./media-signature";
import { MAX_UPLOAD_SIZE, UPLOAD_TYPES } from "./media-types";

const ALLOWED_TYPES = new Set<string>(UPLOAD_TYPES);

export type UploadRouterOptions = {
  /** The uploader's user id, or null when the request isn't signed in. */
  authenticate: (req: Request) => Promise<string | null>;
  /** Called once per verified upload, so the app can tie the key to its owner. */
  onUpload: (file: FileInfo, ownerId: string) => Promise<void>;
  secret?: string;
};

// Takes a factory so the route can create the UploadThing client lazily.
export const createUploadRouter = (
  files: Files | (() => Files),
  { authenticate, onUpload, secret = process.env.FILES_API_SECRET }: UploadRouterOptions,
) => {
  // Without a secret, files-sdk signs upload tokens with a random per-process
  // one and only warns. Uploads then fail whenever presign and PUT land on
  // different instances, so fail every request instead.
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("FILES_API_SECRET is not set");
  }

  return createFilesRouter<void, { ownerId: string }>({
    files: () => withSignatureCheck(typeof files === "function" ? files() : files),
    secret,
    // Uploads only. Posts get their media URL from POST /api/posts, and
    // completing an upload doesn't need "head": the router calls files.head().
    // No keyPrefix: the gateway joins it with "/", and UploadThing's CDN 404s
    // on keys containing a slash, which fails the head() that completes uploads.
    operations: ["upload"],
    // Runs on presign and on complete. The PUT in between carries the signed
    // token from presign instead, so it needs no Bearer.
    authorize: async ({ operation, key, params, req }) => {
      const ownerId = await authenticate(req);
      if (!ownerId) throw new FilesError("Unauthorized", "sign in to upload");
      if (operation === "upload") {
        // A client-chosen key could overwrite an existing file; only
        // server-minted keys are allowed.
        if (key !== undefined) {
          throw new FilesError("Invalid", "uploads can't choose their key");
        }
        // Checks the declared type here; withSignatureCheck checks the bytes.
        const declared = (params.files ?? []) as { type?: string }[];
        if (declared.some((file) => !ALLOWED_TYPES.has(file.type ?? ""))) {
          throw new FilesError("Invalid", "only images, videos and audio can be uploaded");
        }
      }
      return { context: { ownerId } };
    },
    onUploadComplete: async ({ file, context }) => {
      if (context) await onUpload(file, context.ownerId);
    },
    maxUploadSize: MAX_UPLOAD_SIZE,
  });
};
