"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useApi } from "@/lib/api-client";
import { POINTS } from "@/lib/game";
import { useApplyGains } from "@/lib/gains";
import type { PointsResponse, PostView } from "@/lib/types";
import Artwork from "./artwork";
import Avatar from "./avatar";
import { BoltIcon, BookmarkIcon, CommentIcon, HeartIcon, MoreIcon, SendIcon } from "./icons";

const formatCount = (n: number) => n.toLocaleString("fr-FR");

type DoseResponse = Partial<PointsResponse> & { doses: number; dosedByMe: boolean };

// Bonne dose (like) avec mise à jour optimiste, partagée par les posts et les reels.
export function useDose(post: PostView) {
  const api = useApi();
  const applyGains = useApplyGains();
  const [dosed, setDosed] = useState(post.dosedByMe);
  const [doses, setDoses] = useState(post.doses);

  const toggle = async () => {
    const next = !dosed;
    setDosed(next);
    setDoses((n) => n + (next ? 1 : -1));
    try {
      const path = `/api/posts/${post.id}/likes`;
      const response = next ? await api.post<DoseResponse>(path) : await api.del<DoseResponse>(path);
      setDosed(response.dosedByMe);
      setDoses(response.doses);
      applyGains(response);
    } catch {
      setDosed(!next);
      setDoses((n) => n + (next ? -1 : 1));
    }
  };

  return { dosed, doses, toggle };
}

export function PostMedia({ post, className = "h-full w-full object-cover" }: { post: PostView; className?: string }) {
  if (post.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- média servi par /api/media (session requise)
    return <img src={post.imageUrl} alt={post.caption} className={className} />;
  }
  if (post.videoUrl) {
    return <video src={post.videoUrl} className={className} muted loop autoPlay playsInline aria-label={post.caption} />;
  }
  return <Artwork variant={post.art} label={post.caption} />;
}

export default function PostCard({ post }: { post: PostView }) {
  const api = useApi();
  const applyGains = useApplyGains();
  const { data: session } = useSession();
  const { dosed, doses, toggle } = useDose(post);
  const [saved, setSaved] = useState(post.savedByMe);
  const [comments, setComments] = useState(post.comments);
  const [commenting, setCommenting] = useState(false);
  const [draft, setDraft] = useState("");

  const username = post.author?.username ?? "compte supprimé";
  const profileHref = !post.author || post.author.id === session?.user.id ? "/profil" : `/u/${post.author.username}`;

  const toggleSave = async () => {
    const next = !saved;
    setSaved(next);
    try {
      const path = `/api/posts/${post.id}/saves`;
      await (next ? api.post(path) : api.del(path));
    } catch {
      setSaved(!next);
    }
  };

  const submitComment = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    try {
      const response = await api.post<PointsResponse & { comment: PostView["comments"][number] }>(
        `/api/posts/${post.id}/comments`,
        { text },
      );
      setComments((list) => [...list, response.comment]);
      applyGains(response);
    } catch {
      setDraft(text);
    }
  };

  return (
    <article className="-mx-4 flex flex-col">
      <header className="flex items-center gap-3 px-4 pb-3">
        <Link href={profileHref}>
          <Avatar name={post.author?.name ?? username} seed={post.author?.id ?? username} size={36} />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <Link href={profileHref} className="font-semibold">
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

      <div className="relative aspect-square select-none" onDoubleClick={() => !dosed && toggle()}>
        <PostMedia post={post} />
        {!dosed && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border border-lime bg-ink/80 px-2.5 py-1 text-xs font-semibold text-lime">
            <BoltIcon size={11} /> +{POINTS.dose} pts
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 px-4 pt-3">
        <button
          type="button"
          onClick={toggle}
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
          onClick={toggleSave}
          aria-pressed={saved}
          aria-label={saved ? "Retirer des enregistrements" : "Enregistrer"}
          className="ml-auto"
        >
          <BookmarkIcon filled={saved} size={25} />
        </button>
      </div>

      <div className="flex flex-col gap-1 px-4 pt-2 text-[15px]">
        <p className="font-semibold">{formatCount(doses)} Bonnes doses</p>
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
