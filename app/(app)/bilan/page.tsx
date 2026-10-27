"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TopBar, { BackLink } from "@/components/top-bar";
import { useDetox } from "@/lib/store";

function formatDuration(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "moins d'une minute";
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}

function serenityLabel(value: number) {
  if (value > 80) return "Zen. Pour l'instant.";
  if (value > 50) return "Légèrement agité.";
  if (value > 20) return "Le pouce tremble.";
  return "Sérénité épuisée.";
}

// Écran de fin de démo : ce que l'appli t'a coûté, et ce qu'elle t'a donné (rien).
export default function BilanPage() {
  const state = useDetox();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  const timeSpent =
    state.timeSpentMs + (state.sessionStartedAt && now ? Math.max(0, now - state.sessionStartedAt) : 0);

  const rows = [
    { label: "Temps passé", value: formatDuration(timeSpent) },
    { label: "Pages de Flow lues", value: state.flowPagesRead.length },
    { label: "Bonnes doses données", value: state.dosedPostIds.length },
    { label: "Points gagnés", value: `${state.totalEarned.toLocaleString("fr-FR")} pts`, tone: "text-lime" },
    { label: "Points dépensés", value: `${state.totalSpent.toLocaleString("fr-FR")} pts`, tone: "text-sun" },
    { label: "Commandes passées", value: state.orders.length },
    {
      label: "Amis espionnés",
      value: Object.values(state.skills).filter((skills) => skills.length > 0).length,
    },
  ];

  return (
    <>
      <TopBar />
      <BackLink href="/profil" label="Profil" />
      <h1 className="font-display text-[30px] font-bold">Ton bilan</h1>

      <section className="card flex flex-col gap-3 p-5" aria-label="Sérénité">
        <div className="flex items-baseline justify-between">
          <p className="font-semibold">Sérénité</p>
          <p className="font-pixel text-sm">{state.serenity}%</p>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-line">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ${
              state.serenity > 50 ? "bg-lime" : state.serenity > 20 ? "bg-sun" : "bg-pink"
            }`}
            style={{ width: `${state.serenity}%` }}
          />
        </div>
        <p className="text-sm text-muted">{serenityLabel(state.serenity)}</p>
      </section>

      <dl className="card divide-y divide-line px-5">
        {rows.map(({ label, value, tone }) => (
          <div key={label} className="flex items-center justify-between py-3">
            <dt className="text-muted">{label}</dt>
            <dd className={`font-semibold ${tone ?? ""}`}>{value}</dd>
          </div>
        ))}
      </dl>

      <section className="rounded-3xl border-2 border-pink p-6 text-center">
        <p className="text-muted">Ce que tu as vraiment reçu</p>
        <p className="mt-1 font-display text-5xl font-bold text-pink">rien</p>
        <p className="mt-3 text-sm text-muted">
          Pas de sucre, pas de colis, pas d&apos;ami plus proche. Juste du temps en moins.
        </p>
      </section>

      <Link href="/" className="btn-ghost">
        Reprendre le scroll quand même
      </Link>
      <p className="text-center text-xs text-muted">
        Détox est une parodie. Les mécanismes montrés ici existent dans les vraies applis.
      </p>
    </>
  );
}
