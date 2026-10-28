"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMe } from "@/lib/api-client";
import { BoltIcon, FlameIcon } from "./icons";

export function PointsPill({ value }: { value: number }) {
  return (
    <span className="pill" aria-label={`${value} points`}>
      <span className="font-pixel text-[11px] text-lime tabular-nums">{value}</span>
      <span className="text-xs font-medium text-muted">pts</span>
    </span>
  );
}

function StreakPill({ days }: { days: number }) {
  return (
    <span className="pill text-sun" aria-label={`Série de ${days} jours`}>
      <FlameIcon size={14} /> {days} j
    </span>
  );
}

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 font-display text-[22px] font-bold">
      <BoltIcon size={22} className="-skew-x-12 text-lime" />
      Détox
    </Link>
  );
}

// En-tête des écrans : logo à gauche, série + solde à droite (ou contenu personnalisé).
export default function TopBar({ title, right }: { title?: ReactNode; right?: ReactNode }) {
  const { data } = useMe();
  const points = data?.stats.points ?? 0;
  const streak = data?.stats.streak ?? 0;
  return (
    <header className="flex min-h-11 items-center justify-between gap-3">
      {title ?? <Brand />}
      <div className="flex items-center gap-2">
        {right ?? (
          <>
            <StreakPill days={streak} />
            <PointsPill value={points} />
          </>
        )}
      </div>
    </header>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
      ‹ {label}
    </Link>
  );
}
