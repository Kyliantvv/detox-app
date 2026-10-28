import { POINTS } from "@/lib/game";
import { EXPLORE_TILES } from "@/lib/server/seed";
import { requireUser } from "@/lib/server/auth";
import { db, findPost, uid, userByUsername } from "@/lib/server/db";
import { ApiError, json, route } from "@/lib/server/http";
import { credit, withPoints } from "@/lib/server/points";
import { postView } from "@/lib/server/views";
import { CAPTION_MAX } from "@/lib/validation";

const MAX_MEDIA_BYTES = 20 * 1024 * 1024;

// ?author=<id|username> · ?type=reel · ?saved=1 · ?explore=1 (mosaïque de la recherche)
export const GET = route((request) => {
  const user = requireUser(request);
  const params = request.nextUrl.searchParams;
  if (params.get("explore") === "1") return json({ items: EXPLORE_TILES });

  const store = db();
  let posts = [...store.posts.values()];
  const author = params.get("author");
  if (author) {
    const authorId = store.users.has(author) ? author : userByUsername(author)?.id;
    if (!authorId) throw new ApiError("NOT_FOUND", "Auteur introuvable.");
    posts = posts.filter((post) => post.authorId === authorId);
  }
  const type = params.get("type");
  if (type && type !== "reel" && type !== "post") throw new ApiError("INVALID_INPUT", "type doit valoir reel ou post.");
  if (type) posts = posts.filter((post) => post.isReel === (type === "reel"));
  if (params.get("saved") === "1") {
    // Les posts du Flow ne sont pas stockés : on les retrouve depuis les favoris.
    posts = [...store.saves]
      .filter((key) => key.startsWith(`${user.id}:`))
      .map((key) => findPost(key.slice(user.id.length + 1)))
      .filter((post) => post !== undefined);
  }
  const items = posts.sort((a, b) => b.createdAt - a.createdAt).map((post) => postView(post, user.id));
  return json({ items });
});

// Publication : multipart avec « media » (image ou vidéo) et « caption ».
export const POST = route(async (request) => {
  const user = requireUser(request);
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
  if (media.size > MAX_MEDIA_BYTES) throw new ApiError("INVALID_INPUT", "Fichier trop lourd (20 Mo max).");
  if (typeof caption !== "string" || caption.length > CAPTION_MAX) {
    throw new ApiError("INVALID_INPUT", `Légende : ${CAPTION_MAX} caractères maximum.`);
  }

  const store = db();
  const mediaId = uid();
  store.media.set(mediaId, { type: media.type, bytes: new Uint8Array(await media.arrayBuffer()) });
  const post = {
    id: uid(),
    authorId: user.id,
    location: "Ici",
    createdAt: Date.now(),
    art: "dot" as const,
    caption: caption.trim(),
    baseDoses: 0,
    isReel: media.type.startsWith("video/"),
    mediaId,
  };
  store.posts.set(post.id, post);
  const gains = [credit(user.id, POINTS.reaction, "Publication")];
  return json({ post: postView(post, user.id), ...withPoints(user.id, gains) }, 201);
});
