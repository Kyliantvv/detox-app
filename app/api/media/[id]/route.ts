import { auth } from "@/auth";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { assertId, errorResponse, route } from "@/lib/server/http";

// Médias publiés, gardés en mémoire (remplace le dossier uploads/ de Multer).
// Une balise <img> n'envoie pas de Bearer : on accepte aussi le cookie de session NextAuth.
export const GET = route(async (request, ctx: RouteContext<"/api/media/[id]">) => {
  if (!(await auth())) requireUser(request);
  const { id } = await ctx.params;
  const media = db().media.get(assertId(id));
  if (!media) return errorResponse("NOT_FOUND", "Média introuvable.");
  return new Response(new Blob([media.bytes as BlobPart], { type: media.type }), {
    headers: { "Cache-Control": "private, max-age=31536000, immutable" },
  });
});
