import { FilesError, type Files } from "files-sdk";
import { createFilesRouter } from "files-sdk/api";

// Uploads go through this route (UploadThing can't enforce a size on its
// presigned PUTs), so stay under serverless body limits (Vercel: 4.5 MB).
export const MAX_UPLOAD_SIZE = 4 * 1024 * 1024;

// SVG is left out on purpose: it can carry scripts and is served inline.
export const ALLOWED_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// Takes a factory so the route can create the UploadThing client lazily.
export const createUploadRouter = (files: Files | (() => Files)) =>
  createFilesRouter({
    files,
    // No auth yet: allow uploads and public URLs only.
    // No keyPrefix: the gateway joins it with "/", and UploadThing's CDN 404s
    // on keys containing a slash, which fails the head() that completes uploads.
    operations: ["upload", "url", "head"],
    authorize: ({ operation, key, params }) => {
      if (operation === "upload") {
        // A client-chosen key could overwrite an existing file; only
        // server-minted keys are allowed.
        if (key !== undefined) {
          throw new FilesError("Invalid", "uploads can't choose their key");
        }
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
