import { createRouteHandler } from "files-sdk/next";
import { getFiles } from "@/lib/files";
import { createUploadRouter } from "@/lib/upload-router";

export const { GET, POST, PUT } = createRouteHandler(
  createUploadRouter(getFiles),
);
