"use client";

import Link from "next/link";
import TopBar, { BackLink } from "@/components/top-bar";
import { useMe } from "@/lib/api-client";

function formatDuration(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "moins d'une minute";
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}

function serenityLabel(value: number) {
  if (value > 80) return "Très zen.";
  if (value > 50) return "Plutôt calme.";
  if (value > 20) return "Une petite pause te ferait du bien.";
  return "Il est temps de souffler.";
}

// Bilan d'usage : temps passé, points gagnés et dépensés, Sérénité.
// Les chiffres viennent de GET /api/me : le temps passé est mesuré par le serveur (temps actif).
export default function BilanPage() {
  const { data } = useMe();
  if (!data) return <div className="card h-96 animate-pulse" aria-label="Chargement du bilan" />;
  const { stats } = data;

  const rows = [
    { label: "Temps passé", value: formatDuration(stats.timeSpentMs) },
    { label: "Pages de Flow lues", value: stats.flowPagesRead },
    { label: "Bonnes doses données", value: stats.dosesGiven },
    { label: "Points gagnés", value: `${stats.totalEarned.toLocaleString("fr-FR")} pts`, tone: "text-lime" },
    { label: "Points dépensés", value: `${stats.totalSpent.toLocaleString("fr-FR")} pts`, tone: "text-sun" },
    { label: "Commandes passées", value: stats.orders },
    { label: "Amis espionnés", value: stats.friendsSpied },
  ];

  return (
    <>
      <TopBar />
      <BackLink href="/profil" label="Profil" />
      <h1 className="font-display text-[30px] font-bold">Ton bilan</h1>

      <section className="card flex flex-col gap-3 p-5" aria-label="Sérénité">
        <div className="flex items-baseline justify-between">
          <p className="font-semibold">Sérénité</p>
          <p className="font-pixel text-sm">{stats.serenity}%</p>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-line">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ${
              stats.serenity > 50 ? "bg-lime" : stats.serenity > 20 ? "bg-sun" : "bg-pink"
            }`}
            style={{ width: `${stats.serenity}%` }}
          />
        </div>
        <p className="text-sm text-muted">{serenityLabel(stats.serenity)}</p>
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
        <p className="text-muted">Ton temps sur Détox</p>
        <p className="mt-1 font-display text-5xl font-bold text-pink">{formatDuration(stats.timeSpentMs)}</p>
        <p className="mt-3 text-sm text-muted">
          Prends le temps qu&apos;il te faut : tes points et ta série t&apos;attendent.
        </p>
      </section>

      <Link href="/" className="btn-ghost">
        Retourner au Flow
      </Link>
      <p className="text-center text-xs text-muted">
        Ce bilan t&apos;aide à garder un œil sur ton temps passé et sur ta Sérénité.
      </p>
    </>
  );
}
