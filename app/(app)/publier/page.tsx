"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useSWRConfig } from "swr";
import { ImageIcon } from "@/components/icons";
import TopBar, { BackLink } from "@/components/top-bar";
import { ApiClientError, useApi } from "@/lib/api-client";
import { POINTS } from "@/lib/game";
import { useApplyGains } from "@/lib/gains";
import type { PointsResponse } from "@/lib/types";
import { CAPTION_MAX } from "@/lib/validation";

const MAX_SIZE_MB = 15;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm";

// Publier une photo ou un reel : POST /api/posts en multipart (champs « media » et « caption »).
export default function PublishPage() {
  const router = useRouter();
  const api = useApi();
  const applyGains = useApplyGains();
  const { mutate } = useSWRConfig();
  const [sending, setSending] = useState(false);
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError("Choisis d'abord une photo ou une vidéo.");
      return;
    }
    const form = new FormData();
    form.append("media", file);
    form.append("caption", caption.trim());
    setSending(true);
    try {
      const response = await api.post<PointsResponse>("/api/posts", form);
      applyGains(response);
      void mutate((key) => typeof key === "string" && (key.startsWith("/api/posts") || key === "/api/feed/circle"));
      router.push(file.type.startsWith("video/") ? "/reels" : "/");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Publication impossible.");
      setSending(false);
    }
  };

  const isVideo = file?.type.startsWith("video/");

  return (
    <>
      <TopBar />
      <BackLink href="/" label="Accueil" />
      <h1 className="font-display text-[28px] font-bold">Publier</h1>

      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
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
            maxLength={CAPTION_MAX}
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

        <button type="submit" className="btn-sun" disabled={sending}>
          {sending ? "Publication…" : `Publier · +${POINTS.reaction} pts`}
        </button>
      </form>
    </>
  );
}
