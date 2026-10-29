"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import Avatar from "@/components/avatar";
import CommentsSheet from "@/components/comments-sheet";
import { CommentIcon, HeartIcon, SendIcon } from "@/components/icons";
import { PostMedia, useDose } from "@/components/post-card";
import { PointsPill } from "@/components/top-bar";
import { useApiData, useMe } from "@/lib/api-client";
import type { PostView } from "@/lib/types";

// Reels plein écran, un par un (scroll vertical aimanté). Vidéos lues en boucle, sans son.
export default function ReelsPage() {
  const { data: me } = useMe();
  const { data } = useApiData<{ items: PostView[] }>("/api/feed/reels");

  return (
    <div className="fixed inset-x-0 top-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 mx-auto max-w-[480px] bg-ink">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-ink/80 to-transparent px-4 py-4">
        <h1 className="font-display text-2xl font-bold">Reels</h1>
        <PointsPill value={me?.stats.points ?? 0} />
      </header>

      <div className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto">
        {!data && <div className="h-full animate-pulse bg-panel" aria-label="Chargement des reels" />}
        {data?.items.map((reel) => <Reel key={reel.id} reel={reel} />)}
      </div>
      <style>{`@keyframes reel-zoom { from { transform: scale(1) } to { transform: scale(1.12) } }`}</style>
    </div>
  );
}

function Reel({ reel }: { reel: PostView }) {
  const { dosed, doses, toggle } = useDose(reel);
  const [commentCount, setCommentCount] = useState(reel.comments.length);
  const [commenting, setCommenting] = useState(false);
  // Stable : Dialog replace le focus à chaque nouvelle fonction de fermeture.
  const closeComments = useCallback(() => setCommenting(false), []);
  const username = reel.author?.username ?? "compte supprimé";

  return (
    <section className="relative h-full snap-start" aria-label={`Reel de ${username}`}>
      <div className="absolute inset-0 overflow-hidden" onDoubleClick={() => !dosed && void toggle()}>
        <div className="h-full w-full motion-safe:animate-[reel-zoom_8s_ease-in-out_infinite_alternate]">
          <PostMedia post={reel} />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/60 to-transparent px-4 pt-24 pb-5">
        <div className="flex items-end gap-4">
          <div className="min-w-0 flex-1">
            <Link href={`/u/${username}`} className="flex items-center gap-2 font-semibold">
              <Avatar name={reel.author?.name ?? username} seed={reel.author?.id ?? username} size={32} />
              {username}
            </Link>
            <p className="mt-2 text-[15px]">{reel.caption}</p>
            {reel.reason && <p className="mt-1 text-xs text-lime">{reel.reason}</p>}
          </div>
          <div className="flex flex-col items-center gap-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => void toggle()}
              aria-pressed={dosed}
              aria-label="Bonne dose"
              className={`flex flex-col items-center gap-1 ${dosed ? "text-pink" : ""}`}
            >
              <HeartIcon filled={dosed} size={30} className={dosed ? "animate-pop" : ""} />
              {doses.toLocaleString("fr-FR")}
            </button>
            <button
              type="button"
              onClick={() => setCommenting(true)}
              aria-haspopup="dialog"
              aria-label="Commentaires"
              className="flex flex-col items-center gap-1"
            >
              <CommentIcon size={28} />
              {commentCount}
            </button>
            <Link href="/messages" aria-label="Envoyer" className="flex flex-col items-center gap-1">
              <SendIcon size={28} />
            </Link>
          </div>
        </div>
      </div>
      {commenting && (
        <CommentsSheet
          postId={reel.id}
          onClose={closeComments}
          onAdded={() => setCommentCount((n) => n + 1)}
        />
      )}
    </section>
  );
}
