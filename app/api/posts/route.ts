import { db, type Prisma } from "@/lib/db";
import { POINTS } from "@/lib/game";
import type { ArtVariant, ExploreTile } from "@/lib/types";
import { requireUser } from "@/lib/server/auth";
import { ApiError, json, route } from "@/lib/server/http";
import { credit, withPoints } from "@/lib/server/points";
import { visibleWhere } from "@/lib/server/posts";
import { followingIds, postView, postViews } from "@/lib/server/views";
import { CAPTION_MAX } from "@/lib/validation";

// Un document MongoDB fait 16 Mo au plus : le média est stocké d'un bloc dans la collection media.
const MAX_MEDIA_BYTES = 15 * 1024 * 1024;
const LIMIT = 60;
const OBJECT_ID = /^[0-9a-f]{24}$/i;

// Mosaïque de la Recherche : posts récents, rangés sous les filtres du front.
async function exploreTiles(userId: string, visible: Prisma.PostWhereInput): Promise<ExploreTile[]> {
  const [posts, following] = await Promise.all([
    db.post.findMany({ where: { AND: [{ type: "photo" }, visible] }, orderBy: { createdAt: "desc" }, take: 30 }),
    followingIds(userId),
  ]);
  const followed = new Set(following);
  const popularity = posts.map((post) => post.baseLikes + post.likesCount).sort((a, b) => b - a);
  const trending = popularity[Math.floor(popularity.length / 3)] ?? 0;
  return posts.map((post) => ({
    id: post.id,
    art: post.art as ArtVariant,
    tags: [
      "Pour toi",
      ...(post.baseLikes + post.likesCount >= trending ? ["Tendances"] : []),
      ...(followed.has(post.authorId) ? ["Amis"] : []),
      ...(post.tags.includes("voyage") ? ["Voyage"] : []),
    ],
  }));
}

/**
 * @openapi
 * /api/posts:
 *   get:
 *     tags: [Posts]
 *     summary: Lister les posts
 *     description: Les posts `closeFriends` d'un compte qui ne m'a pas dans son cercle proche sont masqués. Maximum 60. Avec `explore=1`, renvoie la mosaïque de la Recherche.
 *     parameters:
 *       - { name: author, in: query, required: false, schema: { type: string }, description: Id ou nom d'utilisateur }
 *       - { name: type, in: query, required: false, schema: { type: string, enum: [reel, post] } }
 *       - { name: saved, in: query, required: false, schema: { type: string, enum: ['1'] }, description: Mes posts enregistrés }
 *       - { name: explore, in: query, required: false, schema: { type: string, enum: ['1'] }, description: Mosaïque de la Recherche (ExploreTile) }
 *     responses:
 *       '200': { description: Posts, du plus récent au plus ancien, content: { application/json: { schema: { type: object, properties: { items: { type: array, items: { oneOf: [{ $ref: '#/components/schemas/PostView' }, { $ref: '#/components/schemas/ExploreTile' }] } } } } } } }
 *       '400': { $ref: '#/components/responses/InvalidInput' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 *   post:
 *     tags: [Posts]
 *     summary: Publier une photo ou un reel
 *     description: Le média (15 Mo maximum) est gardé dans MongoDB et servi par GET /api/media/{id}. Une vidéo crée un reel.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [media]
 *             properties:
 *               media: { type: string, format: binary, description: Image ou vidéo }
 *               caption: { type: string, maxLength: 300 }
 *     responses:
 *       '201': { description: Post publié, content: { application/json: { schema: { allOf: [{ type: object, properties: { post: { $ref: '#/components/schemas/PostView' } } }, { $ref: '#/components/schemas/PointsResponse' }] } } } }
 *       '400': { $ref: '#/components/responses/InvalidInput' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 */
// ?author=<id|username> · ?type=reel · ?saved=1 · ?explore=1 (mosaïque de la recherche)
export const GET = route(async (request) => {
  const user = await requireUser(request);
  const params = request.nextUrl.searchParams;
  const visible = await visibleWhere(user.id);
  if (params.get("explore") === "1") return json({ items: await exploreTiles(user.id, visible) });

  const where: Prisma.PostWhereInput[] = [visible];
  const author = params.get("author");
  if (author) {
    const found = await db.user.findFirst({
      where: OBJECT_ID.test(author) ? { id: author } : { username: author.toLowerCase() },
      select: { id: true },
    });
    if (!found) throw new ApiError("NOT_FOUND", "Auteur introuvable.");
    where.push({ authorId: found.id });
  }
  const type = params.get("type");
  if (type && type !== "reel" && type !== "post") throw new ApiError("INVALID_INPUT", "type doit valoir reel ou post.");
  if (type) where.push({ type: type === "reel" ? "reel" : "photo" });
  if (params.get("saved") === "1") {
    const saves = await db.save.findMany({ where: { userId: user.id }, select: { postId: true } });
    where.push({ id: { in: saves.map((save) => save.postId) } });
  }
  const posts = await db.post.findMany({ where: { AND: where }, orderBy: { createdAt: "desc" }, take: LIMIT });
  return json({ items: await postViews(posts, user.id) });
});

// Publication : multipart avec « media » (image ou vidéo) et « caption ».
export const POST = route(async (request) => {
  const user = await requireUser(request);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError("INVALID_INPUT", "Corps multipart/form-data attendu.");
  }
  const unknown = [...form.keys()].filter((key) => key !== "media" && key !== "caption");
  if (unknown.length) throw new ApiError("INVALID_INPUT", `Champ(s) inconnu(s) : ${unknown.join(", ")}.`);
  const media = form.get("media");
  const caption = form.get("caption") ?? "";
  if (!(media instanceof File) || !/^(image|video)\//.test(media.type)) {
    throw new ApiError("INVALID_INPUT", "Champ « media » : image ou vidéo attendue.");
  }
  if (media.size > MAX_MEDIA_BYTES) throw new ApiError("INVALID_INPUT", "Fichier trop lourd (15 Mo max).");
  if (typeof caption !== "string" || caption.length > CAPTION_MAX) {
    throw new ApiError("INVALID_INPUT", `Légende : ${CAPTION_MAX} caractères maximum.`);
  }

  const now = new Date();
  const stored = await db.media.create({
    data: { ownerId: user.id, mime: media.type, data: new Uint8Array(await media.arrayBuffer()), createdAt: now },
  });
  const post = await db.post.create({
    data: {
      authorId: user.id,
      type: media.type.startsWith("video/") ? "reel" : "photo",
      mediaPath: `/api/media/${stored.id}`,
      mediaMime: media.type,
      location: "Ici",
      caption: caption.trim(),
      createdAt: now,
    },
  });
  const gains = await credit(user.id, POINTS.reaction, "post", "Publication", { refId: post.id });
  return json({ post: await postView(post, user.id), ...(await withPoints(user.id, gains)) }, 201);
});
