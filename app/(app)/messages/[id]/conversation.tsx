"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Avatar from "@/components/avatar";
import { ChevronLeftIcon, SendIcon } from "@/components/icons";
import { friendById } from "@/lib/mock-data";
import { messagesFor, sendMessage, useDetox } from "@/lib/store";

// TODO API : GET /api/conversations/:id/messages (polling toutes les 3 s), POST pour envoyer.
export default function Conversation({ conversationId, friendId }: { conversationId: string; friendId: string }) {
  const state = useDetox();
  const friend = friendById(friendId)!;
  const messages = messagesFor(state, conversationId);
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    sendMessage(conversationId, draft.trim());
    setDraft("");
  };

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
            {message.text}
          </li>
        ))}
      </ol>
      <div ref={bottom} />

      <form
        onSubmit={submit}
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
