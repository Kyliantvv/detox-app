import { createRouteHandler } from "files-sdk/next";
import { getFiles } from "@/lib/files";
import { createUploadRouter } from "@/lib/upload-router";

let handlers: ReturnType<typeof createRouteHandler> | undefined;

// Built on first request, not at import: the router needs FILES_API_SECRET,
// which `next build` shouldn't require.
const getHandlers = () =>
  (handlers ??= createRouteHandler(createUploadRouter(getFiles)));

export const GET = (req: Request) => getHandlers().GET(req);
export const POST = (req: Request) => getHandlers().POST(req);
export const PUT = (req: Request) => getHandlers().PUT(req);
