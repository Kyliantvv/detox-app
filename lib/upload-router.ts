import { FilesError, type Files } from "files-sdk";
import { createFilesRouter } from "files-sdk/api";
import { withImageCheck } from "./image-signature";
import { IMAGE_TYPES } from "./image-types";

// Uploads go through this route (UploadThing can't enforce a size on its
// presigned PUTs), so stay under serverless body limits (Vercel: 4.5 MB).
export const MAX_UPLOAD_SIZE = 4 * 1024 * 1024;

const ALLOWED_TYPES = new Set<string>(IMAGE_TYPES);

// Takes a factory so the route can create the UploadThing client lazily.
export const createUploadRouter = (
  files: Files | (() => Files),
  secret = process.env.FILES_API_SECRET,
) => {
  // Without a secret, files-sdk signs upload tokens with a random per-process
  // one and only warns. Uploads then fail whenever presign and PUT land on
  // different instances, so fail every request instead.
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("FILES_API_SECRET is not set");
  }

  return createFilesRouter({
    files: () => withImageCheck(typeof files === "function" ? files() : files),
    secret,
    // No auth yet: allow uploads and public URLs only. Completing an upload
    // doesn't need "head"; the router calls files.head() itself.
    // No keyPrefix: the gateway joins it with "/", and UploadThing's CDN 404s
    // on keys containing a slash, which fails the head() that completes uploads.
    operations: ["upload", "url"],
    authorize: ({ operation, key, params }) => {
      if (operation === "upload") {
        // A client-chosen key could overwrite an existing file; only
        // server-minted keys are allowed.
        if (key !== undefined) {
          throw new FilesError("Invalid", "uploads can't choose their key");
        }
        // Checks the declared type here; withImageCheck checks the bytes.
        const declared = (params.files ?? []) as { type?: string }[];
        if (declared.some((file) => !ALLOWED_TYPES.has(file.type ?? ""))) {
          throw new FilesError("Invalid", "only images can be uploaded");
        }
      }
      // UploadThing can't bind Content-Disposition into its CDN URLs, so url()
      // needs inline allowed explicitly to show images.
      return { disposition: "inline" };
    },
    maxUploadSize: MAX_UPLOAD_SIZE,
  });
};
