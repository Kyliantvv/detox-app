"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Avatar from "@/components/avatar";
import { ChevronLeftIcon, SendIcon } from "@/components/icons";
import { useApi, useApiData } from "@/lib/api-client";
import type { ChatMessage, PublicUser } from "@/lib/types";

const POLL_MS = 3000;
// Lien de post partagé depuis la fenêtre « Partager » (components/share-sheet.tsx).
const SHARED_POST = /https?:\/\/\S+\/p\/([0-9a-f]{24})\b/i;

function MessageText({ text }: { text: string }) {
  const match = SHARED_POST.exec(text);
  if (!match) return text;
  const before = text.slice(0, match.index).trim();
  const after = text.slice(match.index + match[0].length).trim();
  return (
    <>
      {before && <span className="block">{before}</span>}
      <Link href={`/p/${match[1]}`} className="font-semibold underline underline-offset-2">
        Voir le post
      </Link>
      {after && <span className="block">{after}</span>}
    </>
  );
}

// Fil de discussion lu en polling (GET toutes les 3 s), envoi par POST.
export default function Conversation({ userId }: { userId: string }) {
  const api = useApi();
  const path = `/api/conversations/${encodeURIComponent(userId)}/messages`;
  const { data, error, mutate } = useApiData<{ user: PublicUser; items: ChatMessage[] }>(path, {
    refreshInterval: POLL_MS,
  });
  const messages = data?.items ?? [];
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    try {
      const { message } = await api.post<{ message: ChatMessage }>(path, { text });
      await mutate((current) => current && { ...current, items: [...current.items, message] }, { revalidate: false });
    } catch {
      setDraft(text);
    }
  };

  if (error?.status === 404) {
    return (
      <div className="card flex flex-col items-center gap-3 p-6 text-center">
        <p className="font-display text-lg font-bold">Conversation introuvable.</p>
        <Link href="/messages" className="btn-ghost">
          Retour aux messages
        </Link>
      </div>
    );
  }
  if (!data) return <div className="h-14 animate-pulse rounded-xl bg-panel" aria-label="Chargement de la conversation" />;
  const friend = data.user;

  return (
    <>
      <header className="sticky top-0 z-10 -mx-4 -mt-4 flex items-center gap-3 border-b border-line bg-ink/95 px-4 py-3 backdrop-blur">
        <Link href="/messages" aria-label="Retour aux messages" className="-ml-1 p-1">
          <ChevronLeftIcon />
        </Link>
        <Link href={`/u/${friend.username}`} className="flex items-center gap-3">
          <Avatar name={friend.name} seed={friend.id} size={36} />
          <span className="leading-tight">
            <span className="block font-semibold">{friend.username}</span>
            <span className="text-xs text-muted">{friend.status}</span>
          </span>
        </Link>
      </header>

      <ol className="flex flex-col gap-2" aria-live="polite">
        {messages.map((message) => (
          <li
            key={message.id}
            className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-[15px] ${
              message.from === "me"
                ? "self-end rounded-br-md bg-pink text-ink"
                : "self-start rounded-bl-md border border-line bg-panel"
            }`}
          >
            <MessageText text={message.text} />
          </li>
        ))}
      </ol>
      <div ref={bottom} />

      <form
        onSubmit={(event) => void submit(event)}
        className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-[480px] gap-2 border-t border-line bg-ink px-4 py-3"
      >
        <label htmlFor="message" className="sr-only">
          Ton message
        </label>
        <input
          id="message"
          className="input flex-1"
          placeholder="Écris un message…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoComplete="off"
        />
        <button type="submit" className="btn-sun w-12 px-0" aria-label="Envoyer" disabled={!draft.trim()}>
          <SendIcon size={20} />
        </button>
      </form>
      <div className="h-16" />
    </>
  );
}
