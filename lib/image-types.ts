// Shared by the server allowlist and the file picker's `accept`, so keep this
// file free of server-only imports.
// SVG is left out on purpose: it can carry scripts and is served inline.
export const IMAGE_TYPES = [
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ImageType = (typeof IMAGE_TYPES)[number];
