// Partagé par la liste blanche du serveur et l'`accept` du sélecteur de fichier :
// ce module ne doit rien importer de serveur.
// Pas de SVG : il peut contenir des scripts et serait servi depuis notre domaine.
export const IMAGE_TYPES = ["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"] as const;

// Une vidéo publiée devient un reel.
export const VIDEO_TYPES = ["video/mp4", "video/webm"] as const;

export const MEDIA_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

export const isMediaType = (type: string): type is MediaType => (MEDIA_TYPES as readonly string[]).includes(type);

// Le fichier transite dans le corps de POST /api/posts : rester sous la limite
// de Vercel (4,5 Mo par requête), et loin des 16 Mo d'un document MongoDB.
export const MAX_UPLOAD_SIZE = 4 * 1024 * 1024;
