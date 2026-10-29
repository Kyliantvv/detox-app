"use client";

import { useEffect, useState } from "react";
import { useApi, useApiData } from "@/lib/api-client";
import type { ConversationItem, PostAuthor, PublicUser } from "@/lib/types";
import Avatar from "./avatar";
import Dialog from "./dialog";
import { SearchIcon } from "./icons";

const DEBOUNCE_MS = 250;

// Lien absolu vers la page d'un post, lu par la conversation pour afficher l'aperçu du post.
export const postUrl = (postId: string) => `${window.location.origin}/p/${postId}`;

// Partage d'un post : envoi du lien à un compte (conversations récentes, ou recherche),
// ou copie / partage natif. Écrire à un compte sans conversation en ouvre une.
export default function ShareSheet({ postId, onClose }: { postId: string; onClose: () => void }) {
  const api = useApi();
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [sent, setSent] = useState<Set<string>>(() => new Set());
  const [copied, setCopied] = useState(false);
  const { data: recent } = useApiData<{ items: ConversationItem[] }>("/api/conversations");
  const { data: found } = useApiData<{ items: PublicUser[] }>(q ? `/api/users?q=${encodeURIComponent(q)}` : null, {
    keepPreviousData: true,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const searching = query.trim() !== "";
  const people: PostAuthor[] | undefined = searching
    ? found?.items
    : recent?.items.map((conversation) => conversation.user);

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
      <label className="input mb-3 flex items-center gap-3">
        <SearchIcon size={20} className="text-muted" />
        <span className="sr-only">Rechercher un compte</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher"
          className="h-full flex-1 bg-transparent outline-none placeholder:text-muted"
        />
      </label>
      <ul className="flex max-h-[45vh] flex-col gap-1 overflow-y-auto">
        {!people && <li className="h-12 animate-pulse rounded-xl bg-ink" aria-label="Chargement des comptes" />}
        {people?.length === 0 && (
          <li className="py-4 text-center text-sm text-muted">
            {searching ? `Aucun compte pour « ${query.trim()} ».` : "Aucune conversation. Cherche un compte."}
          </li>
        )}
        {people?.map((user) => (
          <li key={user.id} className="flex items-center gap-3 py-1.5">
            <Avatar name={user.name} seed={user.id} size={40} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate font-semibold">{user.username}</span>
              <span className="block truncate text-sm text-muted">{user.name}</span>
            </span>
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
