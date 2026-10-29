// Shared by the server allowlist and the file picker's `accept`, so keep this
// file free of server-only imports.
// SVG is left out on purpose: it can carry scripts.
export const IMAGE_TYPES = [
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

// A video post becomes a reel.
export const VIDEO_TYPES = ["video/mp4", "video/webm"] as const;

export const MEDIA_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

// Voice messages, as recorded by MediaRecorder: Chrome makes WebM, Firefox
// Ogg, Safari MP4. Messages only; a post stays a photo or a video.
export const AUDIO_TYPES = ["audio/webm", "audio/ogg", "audio/mp4"] as const;

// Everything /api/files accepts.
export const UPLOAD_TYPES = [...MEDIA_TYPES, ...AUDIO_TYPES] as const;

export type UploadType = (typeof UPLOAD_TYPES)[number];

// Uploads go through /api/files (UploadThing can't enforce a size on its
// presigned PUTs), so stay under serverless body limits (Vercel: 4.5 MB).
export const MAX_UPLOAD_SIZE = 4 * 1024 * 1024;
