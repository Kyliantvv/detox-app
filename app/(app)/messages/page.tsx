"use client";

import Link from "next/link";
import Avatar from "@/components/avatar";
import TopBar from "@/components/top-bar";
import { CONVERSATIONS, friendById } from "@/lib/mock-data";
import { messagesFor, useDetox } from "@/lib/store";

// TODO API : GET /api/conversations.
export default function MessagesPage() {
  const state = useDetox();

  return (
    <>
      <TopBar />
      <h1 className="font-display text-[28px] font-bold">Messages</h1>
      <ul className="flex flex-col gap-2">
        {CONVERSATIONS.map((conversation) => {
          const friend = friendById(conversation.friendId)!;
          const messages = messagesFor(state, conversation.id);
          const last = messages.at(-1);
          const unread = conversation.unread && !state.messages[conversation.id];
          return (
            <li key={conversation.id}>
              <Link href={`/messages/${conversation.id}`} className="card flex items-center gap-3 px-4 py-3">
                <Avatar name={friend.name} seed={friend.id} size={46} />
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold ${unread ? "text-fg" : ""}`}>{friend.username}</p>
                  <p className={`truncate text-sm ${unread ? "font-semibold text-fg" : "text-muted"}`}>
                    {last ? `${last.from === "me" ? "Toi : " : ""}${last.text}` : conversation.preview}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-xs text-muted">{state.messages[conversation.id] ? "à l'instant" : conversation.ago}</span>
                  {unread && <span className="size-2.5 rounded-full bg-pink" aria-label="Non lu" />}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="text-center text-xs text-muted">
        Clairvoyance ne voit jamais le contenu de tes messages. Seulement tout le reste.
      </p>
    </>
  );
}
