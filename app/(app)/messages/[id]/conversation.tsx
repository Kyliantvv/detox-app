"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Avatar from "@/components/avatar";
import { ChevronLeftIcon, CloseIcon, ImageIcon, SendIcon, SmileIcon } from "@/components/icons";
import { PostMedia } from "@/components/post-card";
import { ApiClientError, useApi, useApiData } from "@/lib/api-client";
import { MAX_UPLOAD_SIZE, MEDIA_TYPES } from "@/lib/media-types";
import type { ChatMessage, PostView, PublicUser } from "@/lib/types";

const POLL_MS = 3000;
const ACCEPT = MEDIA_TYPES.join(",");
const MAX_SIZE_MB = MAX_UPLOAD_SIZE / (1024 * 1024);
const EMOJIS = [
  "😂", "🥲", "😍", "😭", "😅", "🙃", "😎", "🤔",
  "😴", "🤯", "💀", "👀", "🙏", "👍", "🫶", "❤️",
  "🔥", "✨", "🎉", "📵", "🧘", "🌿", "☕", "🍬",
];
// Un message fait d'un à trois emojis s'affiche en grand, sans bulle.
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\ufe0f|\s)+$/u;
const isBigEmoji = (text: string) =>
  EMOJI_ONLY.test(text) && [...new Intl.Segmenter().segment(text.replace(/\s/g, ""))].length <= 3;
// Lien de post partagé depuis la fenêtre « Partager » (components/share-sheet.tsx), affiché en aperçu.
const SHARED_POST = /https?:\/\/\S+\/p\/([0-9a-f]{24})\b/i;

// Aperçu d'un post partagé : média, auteur et légende, ouvre la page du post.
function SharedPost({ id }: { id: string }) {
  const { data, error } = useApiData<{ post: PostView }>(`/api/posts/${id}`);
  if (error) {
    return <span className="mt-1 block rounded-xl bg-ink px-3 py-2 text-sm text-muted">Post indisponible.</span>;
  }
  if (!data) return <span className="mt-1 block aspect-square w-56 animate-pulse rounded-xl bg-ink" aria-label="Chargement du post" />;
  const { post } = data;
  const username = post.author?.username ?? "compte supprimé";
  return (
    <Link
      href={`/p/${post.id}`}
      aria-label={`Post de ${username}`}
      className="mt-1 block w-56 overflow-hidden rounded-xl border border-line bg-ink text-fg"
    >
      <span className="flex items-center gap-2 px-3 py-2 text-sm font-semibold">
        <Avatar name={post.author?.name ?? username} seed={post.author?.id ?? username} size={24} />
        <span className="truncate">{username}</span>
      </span>
      <span className="block aspect-square">
        <PostMedia post={post} />
      </span>
      {post.caption && <span className="line-clamp-2 block px-3 py-2 text-sm">{post.caption}</span>}
    </Link>
  );
}

function MessageText({ text }: { text: string }) {
  const match = SHARED_POST.exec(text);
  if (!match) return text;
  const before = text.slice(0, match.index).trim();
  const after = text.slice(match.index + match[0].length).trim();
  return (
    <>
      {before && <span className="block">{before}</span>}
      <SharedPost id={match[1]} />
      {after && <span className="mt-1 block">{after}</span>}
    </>
  );
}

// Photo ou vidéo jointe à un message, servie par le CDN.
function MessageMedia({ media }: { media: NonNullable<ChatMessage["media"]> }) {
  const className = "block max-h-80 w-56 rounded-xl bg-ink object-cover";
  if (media.mime.startsWith("video/")) {
    return <video src={media.url} className={className} controls playsInline preload="metadata" />;
  }
  return (
    <a href={media.url} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element -- image du CDN UploadThing, taille inconnue */}
      <img src={media.url} alt="Photo envoyée" className={className} loading="lazy" />
    </a>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.from === "me";
  if (!message.media && isBigEmoji(message.text)) {
    return <li className={`${mine ? "self-end" : "self-start"} text-5xl leading-tight`}>{message.text}</li>;
  }
  return (
    <li
      className={`max-w-[78%] rounded-2xl text-[15px] ${message.media ? "p-1" : "px-4 py-2.5"} ${
        mine ? "self-end rounded-br-md bg-pink text-ink" : "self-start rounded-bl-md border border-line bg-panel"
      }`}
    >
      {message.media && <MessageMedia media={message.media} />}
      {message.text && (
        <span className={`block ${message.media ? "px-3 pt-1.5 pb-1" : ""}`}>
          <MessageText text={message.text} />
        </span>
      )}
    </li>
  );
}

// Fil de discussion lu en polling (GET toutes les 3 s), envoi par POST.
// Une photo ou vidéo jointe part d'abord sur /api/files, puis sa clé accompagne le message.
export default function Conversation({ userId }: { userId: string }) {
  const api = useApi();
  const path = `/api/conversations/${encodeURIComponent(userId)}/messages`;
  const { data, error, mutate } = useApiData<{ user: PublicUser; items: ChatMessage[] }>(path, {
    refreshInterval: POLL_MS,
  });
  const messages = data?.items ?? [];
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [emojis, setEmojis] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  // Le panneau d'emojis et l'aperçu de la pièce jointe agrandissent la barre : on garde le dernier message visible.
  const keepBottomVisible = () => requestAnimationFrame(() => bottom.current?.scrollIntoView({ block: "end" }));

  const attach = (chosen: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(chosen);
    setPreview(chosen && URL.createObjectURL(chosen));
    if (chosen) keepBottomVisible();
  };

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    setSendError("");
    if (!chosen) return;
    if (chosen.size > MAX_UPLOAD_SIZE) {
      setSendError(`Fichier trop lourd : ${MAX_SIZE_MB} Mo maximum.`);
      return;
    }
    attach(chosen);
  };

  // Insère l'emoji à la place du curseur.
  const insert = (emoji: string) => {
    const field = input.current;
    const start = field?.selectionStart ?? draft.length;
    const end = field?.selectionEnd ?? draft.length;
    setDraft(draft.slice(0, start) + emoji + draft.slice(end));
    requestAnimationFrame(() => field?.setSelectionRange(start + emoji.length, start + emoji.length));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if ((!text && !file) || sending) return;
    setSending(true);
    setSendError("");
    setEmojis(false);
    try {
      const mediaKey = file ? await api.upload(file) : undefined;
      const { message } = await api.post<{ message: ChatMessage }>(path, {
        ...(text ? { text } : {}),
        ...(mediaKey ? { mediaKey } : {}),
      });
      setDraft("");
      attach(null);
      await mutate((current) => current && { ...current, items: [...current.items, message] }, { revalidate: false });
    } catch (err) {
      setSendError(err instanceof ApiClientError ? err.message : "Envoi impossible.");
    } finally {
      setSending(false);
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
          <Bubble key={message.id} message={message} />
        ))}
      </ol>
      <div ref={bottom} />

      <form
        onSubmit={(event) => void submit(event)}
        className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 mx-auto max-w-[480px] border-t border-line bg-ink px-4 py-3"
      >
        {emojis && (
          <div role="group" aria-label="Emojis" className="mb-3 grid grid-cols-8 gap-1">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insert(emoji)}
                className="rounded-lg py-1 text-2xl hover:bg-panel"
                aria-label={`Ajouter ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        {preview && file && (
          <div className="relative mb-3 w-20">
            {file.type.startsWith("video/") ? (
              <video src={preview} className="aspect-square w-20 rounded-xl object-cover" muted playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- aperçu local (URL blob)
              <img src={preview} alt="Pièce jointe" className="aspect-square w-20 rounded-xl object-cover" />
            )}
            <button
              type="button"
              onClick={() => attach(null)}
              aria-label="Retirer la pièce jointe"
              className="absolute -top-2 -right-2 rounded-full border border-line bg-panel p-1"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        )}
        {sendError && (
          <p role="alert" className="mb-2 text-sm text-pink">
            {sendError}
          </p>
        )}
        <div className="flex gap-2">
          <label className="flex w-10 shrink-0 cursor-pointer items-center justify-center text-muted hover:text-fg">
            <ImageIcon size={22} />
            <span className="sr-only">Joindre une photo ou une vidéo</span>
            <input type="file" accept={ACCEPT} onChange={pick} className="sr-only" disabled={sending} />
          </label>
          <label htmlFor="message" className="sr-only">
            Ton message
          </label>
          <div className="relative flex-1">
            <input
              id="message"
              ref={input}
              className="input w-full pr-11"
              placeholder="Écris un message…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => {
                if (!emojis) keepBottomVisible();
                setEmojis(!emojis);
              }}
              aria-label={emojis ? "Fermer les emojis" : "Emojis"}
              aria-expanded={emojis}
              className={`absolute inset-y-0 right-0 flex w-11 items-center justify-center ${emojis ? "text-sun" : "text-muted hover:text-fg"}`}
            >
              <SmileIcon size={22} />
            </button>
          </div>
          <button
            type="submit"
            className="btn-sun w-12 shrink-0 px-0"
            aria-label="Envoyer"
            disabled={sending || (!draft.trim() && !file)}
          >
            <SendIcon size={20} />
          </button>
        </div>
      </form>
      <div className={emojis || preview ? "h-48" : "h-16"} />
    </>
  );
}
