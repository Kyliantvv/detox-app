"use client";

import Link from "next/link";
import Avatar from "@/components/avatar";
import TopBar from "@/components/top-bar";
import { useApiData } from "@/lib/api-client";
import type { ConversationItem } from "@/lib/types";

const REFRESH_MS = 10_000;

export default function MessagesPage() {
  const { data } = useApiData<{ items: ConversationItem[] }>("/api/conversations", { refreshInterval: REFRESH_MS });

  return (
    <>
      <TopBar />
      <h1 className="font-display text-[28px] font-bold">Messages</h1>
      <ul className="flex flex-col gap-2">
        {!data && <li className="card h-40 animate-pulse" aria-label="Chargement des conversations" />}
        {data?.items.length === 0 && (
          <li className="py-10 text-center text-muted">Aucune conversation. Tes amis scrollent, eux.</li>
        )}
        {data?.items.map((conversation) => {
          const { user: friend, unread } = conversation;
          return (
            <li key={conversation.id}>
              <Link href={`/messages/${conversation.id}`} className="card flex items-center gap-3 px-4 py-3">
                <Avatar name={friend.name} seed={friend.id} size={46} />
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold ${unread ? "text-fg" : ""}`}>{friend.username}</p>
                  <p className={`truncate text-sm ${unread ? "font-semibold text-fg" : "text-muted"}`}>
                    {`${conversation.fromMe ? "Toi : " : ""}${conversation.preview}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-xs text-muted">{conversation.ago}</span>
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
