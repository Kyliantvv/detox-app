"use client";

import { useState, type FormEvent } from "react";
import { useApi, useApiData } from "@/lib/api-client";
import { POINTS } from "@/lib/game";
import { useApplyGains } from "@/lib/gains";
import type { PointsResponse, PostView } from "@/lib/types";
import { COMMENT_MAX } from "@/lib/validation";
import Dialog from "./dialog";

type Comment = PostView["comments"][number];

// Commentaires d'un post dans une fenêtre du bas, pour les reels plein écran.
export default function CommentsSheet({
  postId,
  onClose,
  onAdded,
}: {
  postId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const api = useApi();
  const applyGains = useApplyGains();
  const path = `/api/posts/${postId}/comments`;
  const { data, mutate } = useApiData<{ items: Comment[] }>(path);
  const [draft, setDraft] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    try {
      const response = await api.post<PointsResponse & { comment: Comment }>(path, { text });
      await mutate((current) => ({ items: [...(current?.items ?? []), response.comment] }), { revalidate: false });
      onAdded();
      applyGains(response);
    } catch {
      setDraft(text);
    }
  };

  return (
    <Dialog title="Commentaires" onClose={onClose}>
      <ul className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto text-[15px]" aria-live="polite">
        {!data && <li className="h-10 animate-pulse rounded-xl bg-ink" aria-label="Chargement des commentaires" />}
        {data?.items.length === 0 && <li className="py-4 text-center text-sm text-muted">Aucun commentaire. Lance la conversation.</li>}
        {data?.items.map((comment, index) => (
          <li key={index}>
            <span className="font-semibold">{comment.author}</span> <span className="text-fg/85">{comment.text}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={(event) => void submit(event)} className="mt-4 flex gap-2">
        <label htmlFor={`sheet-comment-${postId}`} className="sr-only">
          Ton commentaire
        </label>
        <input
          id={`sheet-comment-${postId}`}
          className="input min-h-10 flex-1 text-sm"
          placeholder={`Commenter (+${POINTS.reaction} pts)`}
          value={draft}
          maxLength={COMMENT_MAX}
          onChange={(event) => setDraft(event.target.value)}
          autoComplete="off"
        />
        <button type="submit" className="btn-lime min-h-10 px-3 text-sm" disabled={!draft.trim()}>
          Publier
        </button>
      </form>
    </Dialog>
  );
}
