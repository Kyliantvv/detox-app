"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApiData } from "@/lib/api-client";
import type { StoryItem } from "@/lib/types";
import Artwork from "./artwork";
import Avatar from "./avatar";
import { CloseIcon, PlusIcon } from "./icons";

const DURATION_MS = 5000;

type Story = StoryItem & { instant: NonNullable<StoryItem["instant"]> };

// Rangée d'Instants (stories 24 h) des comptes suivis + visionneuse plein écran.
export default function Instants() {
  const { data: session } = useSession();
  const { data } = useApiData<{ items: StoryItem[] }>("/api/stories");
  const friends = data?.items ?? [];
  const withInstant = friends.filter((friend): friend is Story => friend.instant !== null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <ul className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4" aria-label="Instants">
        <li>
          <Link href="/publier" className="flex w-16 flex-col items-center gap-1 text-xs text-muted">
            <span className="relative">
              <Avatar name={session?.user.username ?? "?"} size={58} ring="line" />
              <span className="absolute -right-0.5 -bottom-0.5 grid size-6 place-items-center rounded-full border-2 border-ink bg-sun text-ink">
                <PlusIcon size={14} strokeWidth={3} />
              </span>
            </span>
            Ton Instant
          </Link>
        </li>
        {friends.map((friend) => (
          <li key={friend.id}>
            <button
              type="button"
              disabled={!friend.instant}
              onClick={() => setOpenIndex(withInstant.findIndex((story) => story.id === friend.id))}
              className="flex w-16 flex-col items-center gap-1 text-xs text-muted disabled:cursor-default"
              aria-label={friend.instant ? `Voir l'Instant de ${friend.name}` : friend.name}
            >
              <Avatar name={friend.name} seed={friend.id} size={58} ring={friend.instant ? "pink" : "line"} />
              <span className="max-w-full truncate">{friend.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {openIndex !== null && (
        <InstantViewer
          key={openIndex}
          friend={withInstant[openIndex]}
          onNext={() => setOpenIndex(openIndex + 1 < withInstant.length ? openIndex + 1 : null)}
          onPrev={() => setOpenIndex(Math.max(0, openIndex - 1))}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}

function InstantViewer({
  friend,
  onNext,
  onPrev,
  onClose,
}: {
  friend: Story;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onNext, DURATION_MS);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") onNext();
      if (event.key === "ArrowLeft") onPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onNext, onPrev, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Instant de ${friend.name}`}
      className="fixed inset-0 z-50 mx-auto flex max-w-[480px] flex-col bg-ink"
    >
      <div className="absolute inset-x-3 top-3 z-10 h-1 overflow-hidden rounded-full bg-fg/25">
        <div
          className="h-full rounded-full bg-fg"
          style={{ animation: `instant-progress ${DURATION_MS}ms linear forwards` }}
        />
      </div>
      <div className="absolute inset-x-3 top-6 z-10 flex items-center gap-2">
        <Avatar name={friend.name} seed={friend.id} size={32} />
        <span className="font-semibold">{friend.username}</span>
        <span className="text-sm text-fg/70">{friend.instant.ago}</span>
        <button type="button" onClick={onClose} aria-label="Fermer" className="ml-auto p-2">
          <CloseIcon />
        </button>
      </div>
      <div className="relative flex-1">
        <Artwork variant={friend.instant.art} label={friend.instant.text} />
        <button type="button" aria-label="Instant précédent" onClick={onPrev} className="absolute inset-y-0 left-0 w-1/3" />
        <button type="button" aria-label="Instant suivant" onClick={onNext} className="absolute inset-y-0 right-0 w-2/3" />
      </div>
      <p className="px-5 py-6 text-center text-lg font-semibold">{friend.instant.text}</p>
      <style>{`@keyframes instant-progress { from { width: 0 } to { width: 100% } }`}</style>
    </div>
  );
}
