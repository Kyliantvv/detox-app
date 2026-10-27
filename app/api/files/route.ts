import { createFilesRouter } from "files-sdk/api";
import { createRouteHandler } from "files-sdk/next";
import { files } from "@/lib/files";

const router = createFilesRouter({
  files,
  // No auth yet: allow uploads and public URLs only.
  // No keyPrefix: the gateway joins it with "/", and UploadThing's CDN 404s
  // on keys containing a slash, which fails the head() that completes uploads.
  operations: ["upload", "url", "head"],
  // UploadThing can't bind Content-Disposition into its CDN URLs, so url()
  // needs inline allowed explicitly to show images.
  authorize: async () => ({ disposition: "inline" }),
  // Setting a size cap routes uploads through this gateway, so no
  // UploadThing file-router slug is needed.
  maxUploadSize: 8 * 1024 * 1024,
});

export const { GET, POST, PUT } = createRouteHandler(router);
