"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { friendById } from "@/lib/mock-data";
import { addComment, POINTS, toggleDose, toggleSave, useDetox } from "@/lib/store";
import type { Post } from "@/lib/types";
import Artwork from "./artwork";
import Avatar from "./avatar";
import { BoltIcon, BookmarkIcon, CommentIcon, HeartIcon, MoreIcon, SendIcon } from "./icons";

const formatCount = (n: number) => n.toLocaleString("fr-FR");

export default function PostCard({ post }: { post: Post }) {
  const state = useDetox();
  const [commenting, setCommenting] = useState(false);
  const [draft, setDraft] = useState("");

  const author = friendById(post.authorId);
  const username = author?.username ?? state.user?.username ?? "toi";
  const dosed = state.dosedPostIds.includes(post.id);
  const saved = state.savedPostIds.includes(post.id);
  const comments = [...post.comments, ...(state.comments[post.id] ?? [])];

  const submitComment = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    addComment(post.id, draft.trim());
    setDraft("");
  };

  return (
    <article className="-mx-4 flex flex-col">
      <header className="flex items-center gap-3 px-4 pb-3">
        <Link href={author ? `/u/${author.username}` : "/profil"}>
          <Avatar name={username} seed={author?.id ?? username} size={36} />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <Link href={author ? `/u/${author.username}` : "/profil"} className="font-semibold">
            {username}
          </Link>
          <p className="text-[13px] text-muted">
            {post.location} · {post.ago}
          </p>
        </div>
        <button type="button" aria-label="Plus d'options" className="p-1 text-fg">
          <MoreIcon />
        </button>
      </header>

      <div
        className="relative aspect-square select-none"
        onDoubleClick={() => !dosed && toggleDose(post.id)}
      >
        {post.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- aperçu local (URL blob)
          <img src={post.imageUrl} alt={post.caption} className="h-full w-full object-cover" />
        ) : (
          <Artwork variant={post.art} label={post.caption} />
        )}
        {!dosed && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border border-lime bg-ink/80 px-2.5 py-1 text-xs font-semibold text-lime">
            <BoltIcon size={11} /> +{POINTS.dose} pts
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 px-4 pt-3">
        <button
          type="button"
          onClick={() => toggleDose(post.id)}
          aria-pressed={dosed}
          aria-label={dosed ? "Retirer la Bonne dose" : "Donner une Bonne dose"}
          className={dosed ? "animate-pop text-pink" : "text-fg"}
        >
          <HeartIcon filled={dosed} size={26} />
        </button>
        <button
          type="button"
          onClick={() => setCommenting((open) => !open)}
          aria-expanded={commenting}
          aria-label="Commenter"
        >
          <CommentIcon size={25} />
        </button>
        <Link href="/messages" aria-label="Envoyer en message">
          <SendIcon size={25} />
        </Link>
        <button
          type="button"
          onClick={() => toggleSave(post.id)}
          aria-pressed={saved}
          aria-label={saved ? "Retirer des enregistrements" : "Enregistrer"}
          className="ml-auto"
        >
          <BookmarkIcon filled={saved} size={25} />
        </button>
      </div>

      <div className="flex flex-col gap-1 px-4 pt-2 text-[15px]">
        <p className="font-semibold">
          {formatCount(post.doses + (dosed ? 1 : 0))} Bonnes doses
        </p>
        <p>
          <span className="font-semibold">{username}</span> {post.caption}
        </p>
        {comments.map((comment, index) => (
          <p key={index} className="text-sm">
            <span className="font-semibold">{comment.author}</span>{" "}
            <span className="text-fg/85">{comment.text}</span>
          </p>
        ))}
        {commenting && (
          <form onSubmit={submitComment} className="mt-2 flex gap-2">
            <label htmlFor={`comment-${post.id}`} className="sr-only">
              Ton commentaire
            </label>
            <input
              id={`comment-${post.id}`}
              className="input min-h-10 flex-1 text-sm"
              placeholder={`Commenter (+${POINTS.reaction} pts)`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-lime min-h-10 px-3 text-sm" disabled={!draft.trim()}>
              Publier
            </button>
          </form>
        )}
      </div>
    </article>
  );
}
