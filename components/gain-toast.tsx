"use client";

import { useLastGain } from "@/lib/gains";
import { BoltIcon } from "./icons";

// Petite bulle « +10 pts » qui monte à chaque gain. La clé relance l'animation à chaque événement.
export default function GainToast() {
  const lastGain = useLastGain();
  if (!lastGain) return null;

  return (
    <div
      key={lastGain.id}
      role="status"
      className="pointer-events-none fixed bottom-24 left-1/2 z-40 flex animate-float-up items-center gap-2 rounded-full whitespace-nowrap border border-lime bg-ink/95 px-4 py-2 text-sm font-semibold text-lime shadow-[0_0_24px_rgba(34,255,136,0.25)]"
    >
      <BoltIcon size={14} />
      <span className="font-pixel text-[11px]">+{lastGain.amount}</span>
      <span className="text-fg">{lastGain.label}</span>
    </div>
  );
}
