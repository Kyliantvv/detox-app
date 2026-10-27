"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { ImageIcon } from "@/components/icons";
import TopBar, { BackLink } from "@/components/top-bar";
import { POINTS, publishPost } from "@/lib/store";

const MAX_SIZE_MB = 15;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm";

// Publier une photo ou un reel. TODO API : POST /api/posts en multipart (champ « media » + « caption »).
export default function PublishPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    setError("");
    if (!chosen) return;
    if (chosen.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Fichier trop lourd : ${MAX_SIZE_MB} Mo maximum.`);
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!file || !preview) {
      setError("Choisis d'abord une photo ou une vidéo.");
      return;
    }
    publishPost({
      id: `local-${Date.now()}`,
      authorId: "me",
      location: "Ici",
      ago: "à l'instant",
      art: "dot",
      caption: caption.trim(),
      doses: 0,
      comments: [],
      isReel: file.type.startsWith("video/"),
      imageUrl: file.type.startsWith("image/") ? preview : undefined,
    });
    router.push("/");
  };

  const isVideo = file?.type.startsWith("video/");

  return (
    <>
      <TopBar />
      <BackLink href="/" label="Accueil" />
      <h1 className="font-display text-[28px] font-bold">Publier</h1>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="card flex aspect-square cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden text-muted">
          {preview ? (
            isVideo ? (
              <video src={preview} className="h-full w-full object-cover" muted loop autoPlay playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- aperçu local (URL blob)
              <img src={preview} alt="Aperçu" className="h-full w-full object-cover" />
            )
          ) : (
            <>
              <ImageIcon size={40} />
              <span className="font-semibold text-fg">Choisir une photo ou un reel</span>
              <span className="text-sm">JPG, PNG, WebP, GIF, MP4 ou WebM · {MAX_SIZE_MB} Mo max</span>
            </>
          )}
          <input type="file" accept={ACCEPT} onChange={pick} className="sr-only" />
        </label>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="caption" className="text-sm font-semibold text-muted">
            Légende
          </label>
          <textarea
            id="caption"
            className="input min-h-24 py-3"
            maxLength={300}
            placeholder="Raconte ta détox (ironiquement)."
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-pink px-4 py-3 text-sm text-pink">
            {error}
          </p>
        )}

        <button type="submit" className="btn-sun">
          Publier · +{POINTS.reaction} pts
        </button>
      </form>
    </>
  );
}
