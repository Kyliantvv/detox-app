"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Avatar from "@/components/avatar";
import { ChevronLeftIcon, CloseIcon, ImageIcon, MicIcon, SendIcon, SmileIcon, TrashIcon } from "@/components/icons";
import { PostMedia } from "@/components/post-card";
import { ApiClientError, useApi, useApiData } from "@/lib/api-client";
import { MAX_UPLOAD_SIZE, MEDIA_TYPES } from "@/lib/media-types";
import type { ChatMessage, MessageMedia, PostView, PublicUser } from "@/lib/types";
import { MESSAGE_MEDIA_MAX, VOICE_MAX_SECONDS } from "@/lib/validation";
import { formatDuration, useVoiceRecorder } from "./voice-recorder";

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

// Pièce jointe servie par le CDN UploadThing.
function Attachment({ media, className }: { media: MessageMedia; className: string }) {
  if (media.mime.startsWith("audio/")) {
    return <audio src={media.url} controls preload="metadata" aria-label="Message vocal" className="block w-60 max-w-full" />;
  }
  if (media.mime.startsWith("video/")) {
    return <video src={media.url} className={className} controls playsInline preload="metadata" />;
  }
  return (
    <a href={media.url} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element -- image du CDN, taille inconnue */}
      <img src={media.url} alt="Photo envoyée" className={className} loading="lazy" />
    </a>
  );
}

// Une pièce jointe en grand, plusieurs en grille de vignettes carrées.
function MessageAttachments({ media }: { media: MessageMedia[] }) {
  if (media.length === 1) {
    return <Attachment media={media[0]} className="block max-h-80 w-56 rounded-xl bg-ink object-cover" />;
  }
  return (
    <span className="grid w-56 grid-cols-2 gap-1">
      {media.map((item) => (
        <Attachment key={item.url} media={item} className="block aspect-square w-full rounded-lg bg-ink object-cover" />
      ))}
    </span>
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
      {message.media && <MessageAttachments media={message.media} />}
      {message.text && (
        <span className={`block ${message.media ? "px-3 pt-1.5 pb-1" : ""}`}>
          <MessageText text={message.text} />
        </span>
      )}
    </li>
  );
}

// Fil de discussion lu en polling (GET toutes les 3 s), envoi par POST.
// Photos, vidéos et messages vocaux partent d'abord sur /api/files, puis leurs clés accompagnent le message.
export default function Conversation({ userId }: { userId: string }) {
  const api = useApi();
  const path = `/api/conversations/${encodeURIComponent(userId)}/messages`;
  const { data, error, mutate } = useApiData<{ user: PublicUser; items: ChatMessage[] }>(path, {
    refreshInterval: POLL_MS,
  });
  const messages = data?.items ?? [];
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<{ file: File; preview: string }[]>([]);
  const [emojis, setEmojis] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  // Le panneau d'emojis et l'aperçu des pièces jointes agrandissent la barre : on garde le dernier message visible.
  const keepBottomVisible = () => requestAnimationFrame(() => bottom.current?.scrollIntoView({ block: "end" }));

  const send = async ({ text, files = [] }: { text?: string; files?: File[] }) => {
    setSending(true);
    setSendError("");
    try {
      const mediaKeys = await Promise.all(files.map((file) => api.upload(file)));
      const { message } = await api.post<{ message: ChatMessage }>(path, {
        ...(text ? { text } : {}),
        ...(mediaKeys.length ? { mediaKeys } : {}),
      });
      await mutate((current) => current && { ...current, items: [...current.items, message] }, { revalidate: false });
      return true;
    } catch (err) {
      setSendError(err instanceof ApiClientError ? err.message : "Envoi impossible.");
      return false;
    } finally {
      setSending(false);
    }
  };

  const voice = useVoiceRecorder((file) => void send({ files: [file] }));

  const detach = (index: number) => {
    URL.revokeObjectURL(attachments[index].preview);
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const clearAttachments = () => {
    attachments.forEach((attachment) => URL.revokeObjectURL(attachment.preview));
    setAttachments([]);
  };

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = [...(event.target.files ?? [])];
    event.target.value = "";
    setSendError("");
    if (!chosen.length) return;
    if (chosen.some((file) => file.size > MAX_UPLOAD_SIZE)) {
      setSendError(`Fichier trop lourd : ${MAX_SIZE_MB} Mo maximum.`);
      return;
    }
    const room = MESSAGE_MEDIA_MAX - attachments.length;
    if (chosen.length > room) setSendError(`${MESSAGE_MEDIA_MAX} photos ou vidéos maximum par message.`);
    const added = chosen.slice(0, room).map((file) => ({ file, preview: URL.createObjectURL(file) }));
    if (!added.length) return;
    setAttachments([...attachments, ...added]);
    keepBottomVisible();
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
    if ((!text && !attachments.length) || sending) return;
    setEmojis(false);
    if (await send({ text, files: attachments.map((attachment) => attachment.file) })) {
      setDraft("");
      clearAttachments();
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
  const empty = !draft.trim() && !attachments.length;
  const alert = sendError || voice.error;

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
        {attachments.length > 0 && (
          <ul className="mb-3 flex gap-3 overflow-x-auto pt-2 pr-2" aria-label="Pièces jointes">
            {attachments.map(({ file, preview }, index) => (
              <li key={preview} className="relative w-20 shrink-0">
                {file.type.startsWith("video/") ? (
                  <video src={preview} className="aspect-square w-20 rounded-xl object-cover" muted playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- aperçu local (URL blob)
                  <img src={preview} alt={`Pièce jointe ${index + 1}`} className="aspect-square w-20 rounded-xl object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => detach(index)}
                  aria-label={`Retirer la pièce jointe ${index + 1}`}
                  className="absolute -top-2 -right-2 rounded-full border border-line bg-panel p-1"
                >
                  <CloseIcon size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {alert && (
          <p role="alert" className="mb-2 text-sm text-pink">
            {alert}
          </p>
        )}
        {voice.recording ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={voice.cancel}
              aria-label="Annuler le message vocal"
              className="flex w-10 shrink-0 items-center justify-center text-muted hover:text-fg"
            >
              <TrashIcon size={22} />
            </button>
            <p className="input flex flex-1 items-center gap-2" aria-live="polite">
              <span className="size-2.5 animate-pulse rounded-full bg-pink" aria-hidden />
              <span className="tabular-nums">{formatDuration(voice.seconds)}</span>
              <span className="text-sm text-muted">/ {formatDuration(VOICE_MAX_SECONDS)}</span>
              <span className="sr-only">Enregistrement en cours</span>
            </p>
            <button type="button" onClick={voice.stop} className="btn-sun w-12 shrink-0 px-0" aria-label="Envoyer le message vocal">
              <SendIcon size={20} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <label className="flex w-10 shrink-0 cursor-pointer items-center justify-center text-muted hover:text-fg">
              <ImageIcon size={22} />
              <span className="sr-only">Joindre des photos ou des vidéos</span>
              <input type="file" accept={ACCEPT} multiple onChange={pick} className="sr-only" disabled={sending} />
            </label>
            <label htmlFor="message" className="sr-only">
              Ton message
            </label>
            <div className="relative min-w-0 flex-1">
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
            {empty ? (
              <button
                type="button"
                onClick={() => void voice.start()}
                className="btn-sun w-12 shrink-0 px-0"
                aria-label="Enregistrer un message vocal"
                disabled={sending}
              >
                <MicIcon size={20} />
              </button>
            ) : (
              <button type="submit" className="btn-sun w-12 shrink-0 px-0" aria-label="Envoyer" disabled={sending}>
                <SendIcon size={20} />
              </button>
            )}
          </div>
        )}
      </form>
      <div className={emojis || attachments.length ? "h-48" : "h-16"} />
    </>
  );
}
