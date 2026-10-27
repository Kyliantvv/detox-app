import { createFilesRouter } from "files-sdk/api";
import { createRouteHandler } from "files-sdk/next";
import { files } from "@/lib/files";

const router = createFilesRouter({
  files,
  // No auth yet: allow uploads and public URLs only, scoped under uploads/.
  operations: ["upload", "url", "head"],
  authorize: async () => ({ keyPrefix: "uploads/" }),
  // Setting a size cap routes uploads through this gateway, so no
  // UploadThing file-router slug is needed.
  maxUploadSize: 8 * 1024 * 1024,
});

export const { GET, POST, PUT } = createRouteHandler(router);
