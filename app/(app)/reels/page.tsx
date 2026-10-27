"use client";

import Link from "next/link";
import Artwork from "@/components/artwork";
import Avatar from "@/components/avatar";
import { CommentIcon, HeartIcon, SendIcon } from "@/components/icons";
import { PointsPill } from "@/components/top-bar";
import { friendById, REELS } from "@/lib/mock-data";
import { toggleDose, useDetox } from "@/lib/store";

// Reels plein écran, un par un (scroll vertical aimanté).
// TODO API : posts de type vidéo (GET /api/posts?type=reel) lus avec <video autoPlay muted loop playsInline>.
export default function ReelsPage() {
  const state = useDetox();

  return (
    <div className="fixed inset-x-0 top-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 mx-auto max-w-[480px] bg-ink">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-ink/80 to-transparent px-4 py-4">
        <h1 className="font-display text-2xl font-bold">Reels</h1>
        <PointsPill value={state.points} />
      </header>

      <div className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto">
        {REELS.map((reel) => {
          const author = friendById(reel.authorId)!;
          const dosed = state.dosedPostIds.includes(reel.id);
          return (
            <section key={reel.id} className="relative h-full snap-start" aria-label={`Reel de ${author.username}`}>
              <div className="absolute inset-0 overflow-hidden" onDoubleClick={() => !dosed && toggleDose(reel.id)}>
                <div className="h-full w-full motion-safe:animate-[reel-zoom_8s_ease-in-out_infinite_alternate]">
                  <Artwork variant={reel.art} label={reel.caption} />
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/60 to-transparent px-4 pt-24 pb-5">
                <div className="flex items-end gap-4">
                  <div className="min-w-0 flex-1">
                    <Link href={`/u/${author.username}`} className="flex items-center gap-2 font-semibold">
                      <Avatar name={author.name} seed={author.id} size={32} />
                      {author.username}
                    </Link>
                    <p className="mt-2 text-[15px]">{reel.caption}</p>
                  </div>
                  <div className="flex flex-col items-center gap-4 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleDose(reel.id)}
                      aria-pressed={dosed}
                      aria-label="Bonne dose"
                      className={`flex flex-col items-center gap-1 ${dosed ? "text-pink" : ""}`}
                    >
                      <HeartIcon filled={dosed} size={30} className={dosed ? "animate-pop" : ""} />
                      {(reel.doses + (dosed ? 1 : 0)).toLocaleString("fr-FR")}
                    </button>
                    <span className="flex flex-col items-center gap-1">
                      <CommentIcon size={28} />
                      {reel.comments.length}
                    </span>
                    <Link href="/messages" aria-label="Envoyer" className="flex flex-col items-center gap-1">
                      <SendIcon size={28} />
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
      <style>{`@keyframes reel-zoom { from { transform: scale(1) } to { transform: scale(1.12) } }`}</style>
    </div>
  );
}
