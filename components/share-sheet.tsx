"use client";

import { useState } from "react";
import { useApi, useApiData } from "@/lib/api-client";
import type { ConversationItem } from "@/lib/types";
import Avatar from "./avatar";
import Dialog from "./dialog";

// Lien absolu vers la page d'un post, lu par la conversation pour afficher « Voir le post ».
export const postUrl = (postId: string) => `${window.location.origin}/p/${postId}`;

// Partage d'un post : envoi du lien dans une conversation, ou copie / partage natif.
export default function ShareSheet({ postId, onClose }: { postId: string; onClose: () => void }) {
  const api = useApi();
  const { data } = useApiData<{ items: ConversationItem[] }>("/api/conversations");
  const [sent, setSent] = useState<Set<string>>(() => new Set());
  const [copied, setCopied] = useState(false);

  const send = async (userId: string) => {
    setSent((ids) => new Set(ids).add(userId));
    try {
      await api.post(`/api/conversations/${userId}/messages`, { text: `Regarde ce post : ${postUrl(postId)}` });
    } catch {
      setSent((ids) => {
        const next = new Set(ids);
        next.delete(userId);
        return next;
      });
    }
  };

  const copy = async () => {
    const url = postUrl(postId);
    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Partage annulé ou presse-papiers refusé : rien à signaler.
    }
  };

  return (
    <Dialog title="Partager" onClose={onClose}>
      <ul className="flex max-h-[45vh] flex-col gap-1 overflow-y-auto">
        {!data && <li className="h-12 animate-pulse rounded-xl bg-ink" aria-label="Chargement des conversations" />}
        {data?.items.length === 0 && (
          <li className="py-4 text-center text-sm text-muted">Aucune conversation. Écris d&apos;abord à un ami.</li>
        )}
        {data?.items.map(({ user }) => (
          <li key={user.id} className="flex items-center gap-3 py-1.5">
            <Avatar name={user.name} seed={user.id} size={40} />
            <span className="min-w-0 flex-1 truncate font-semibold">{user.username}</span>
            <button
              type="button"
              onClick={() => void send(user.id)}
              disabled={sent.has(user.id)}
              className={sent.has(user.id) ? "btn-ghost min-h-9 px-3 text-sm" : "btn-lime min-h-9 px-3 text-sm"}
            >
              {sent.has(user.id) ? "Envoyé" : "Envoyer"}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => void copy()} className="btn-ghost mt-4 w-full">
        {copied ? "Lien copié" : "Copier le lien"}
      </button>
    </Dialog>
  );
}
