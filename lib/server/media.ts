import "server-only";
import { ApiError } from "./http";
import { isMediaType, MAX_UPLOAD_SIZE, type MediaType } from "@/lib/media-types";

const ascii = (bytes: Uint8Array, at: number, text: string) =>
  [...text].every((char, i) => bytes[at + i] === char.charCodeAt(0));

// Premiers octets de chaque type accepté. Le Record rend obligatoire une signature
// pour tout type ajouté à MEDIA_TYPES.
const SIGNATURES: Record<MediaType, (b: Uint8Array) => boolean> = {
  "image/avif": (b) => ascii(b, 4, "ftyp") && (ascii(b, 8, "avif") || ascii(b, 8, "avis")),
  "image/gif": (b) => ascii(b, 0, "GIF87a") || ascii(b, 0, "GIF89a"),
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x),
  "image/webp": (b) => ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP"),
  // Boîte ISO BMFF ; la marque à l'octet 8 varie (isom, mp42, avc1…).
  "video/mp4": (b) => ascii(b, 4, "ftyp"),
  // En-tête EBML.
  "video/webm": (b) => [0x1a, 0x45, 0xdf, 0xa3].every((x, i) => b[i] === x),
};

/** Vrai si les premiers octets correspondent au type déclaré : le type envoyé par le client n'est que sa parole. */
export const matchesSignature = (type: string, bytes: Uint8Array) => isMediaType(type) && SIGNATURES[type](bytes);

// Marge pour l'enveloppe multipart et la légende.
const MAX_BODY_SIZE = MAX_UPLOAD_SIZE + 64 * 1024;
const TOO_LARGE = `Fichier trop lourd (${MAX_UPLOAD_SIZE / 1024 / 1024} Mo max).`;

/**
 * Lit le corps multipart sans dépasser MAX_BODY_SIZE : `request.formData()` mettrait
 * tout le corps en mémoire avant qu'on puisse en vérifier la taille.
 */
export async function readMediaForm(request: Request): Promise<FormData> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_SIZE) throw new ApiError("INVALID_INPUT", TOO_LARGE);
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = request.body?.getReader();
  for (let chunk = await reader?.read(); chunk && !chunk.done; chunk = await reader?.read()) {
    size += chunk.value.length;
    if (size > MAX_BODY_SIZE) {
      await reader?.cancel();
      throw new ApiError("INVALID_INPUT", TOO_LARGE);
    }
    chunks.push(chunk.value);
  }
  try {
    const type = request.headers.get("content-type") ?? "";
    return await new Response(new Blob(chunks as BlobPart[]), { headers: { "content-type": type } }).formData();
  } catch {
    throw new ApiError("INVALID_INPUT", "Corps multipart/form-data attendu.");
  }
}

/** Vérifie le fichier d'un post (type autorisé, signature, taille) et renvoie ses octets. */
export async function readMedia(media: FormDataEntryValue | null): Promise<{ mime: MediaType; data: Uint8Array<ArrayBuffer> }> {
  if (!(media instanceof File) || !isMediaType(media.type)) {
    throw new ApiError("INVALID_INPUT", "Champ « media » : image (AVIF, GIF, JPEG, PNG, WebP) ou vidéo (MP4, WebM) attendue.");
  }
  if (media.size > MAX_UPLOAD_SIZE) throw new ApiError("INVALID_INPUT", TOO_LARGE);
  const data = new Uint8Array(await media.arrayBuffer());
  if (!matchesSignature(media.type, data)) {
    throw new ApiError("INVALID_INPUT", "Champ « media » : le contenu ne correspond pas au type du fichier.");
  }
  return { mime: media.type, data };
}

/**
 * En-têtes d'un média servi depuis notre domaine : le navigateur ne doit ni deviner
 * un autre type (nosniff), ni exécuter quoi que ce soit s'il l'ouvre en page (CSP sandbox).
 * Un type hors liste blanche (document ancien) est servi en téléchargement.
 */
export function mediaHeaders(mime: string, size: number): HeadersInit {
  const safe = isMediaType(mime);
  return {
    "Content-Type": safe ? mime : "application/octet-stream",
    "Content-Length": String(size),
    "Content-Disposition": safe ? "inline" : "attachment",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cache-Control": "private, max-age=86400",
  };
}
