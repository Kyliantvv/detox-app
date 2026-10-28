"use client";

import Link from "next/link";
import { useApiData } from "@/lib/api-client";
import type { OrderDetail } from "@/lib/types";

const time = (at: number) => new Date(at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

// Faux suivi : GET /api/orders/[id] calcule les étapes ; on revérifie chaque minute pour les voir avancer.
export default function OrderTracking({ id }: { id: string }) {
  const { data, error } = useApiData<{ order: OrderDetail }>(`/api/orders/${encodeURIComponent(id)}`, {
    refreshInterval: 60_000,
  });

  if (error) {
    return (
      <div className="card flex flex-col items-center gap-3 p-6 text-center">
        <p className="font-semibold">Commande introuvable.</p>
        <Link href="/epicerie/commandes" className="btn-sun">
          Mes commandes
        </Link>
      </div>
    );
  }
  if (!data) return <div className="card h-64 animate-pulse" aria-label="Chargement de la commande" />;
  const { order } = data;

  return (
    <>
      <Link href="/epicerie/commandes" className="text-sm text-muted">
        ‹ Mes commandes
      </Link>
      <section className="card flex flex-col gap-1.5 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">{order.itemName}</h2>
          <span className="text-sm text-muted">{order.price} pts</span>
        </div>
        <p className="font-pixel text-[10px] text-lime">{order.tracking}</p>
        <p className="text-sm text-muted">{order.address}</p>
      </section>

      <ol className="card flex flex-col gap-4 p-4" aria-label="Suivi du colis">
        {order.steps.map((step) => (
          <li key={step.label} className="flex items-start gap-3">
            <span
              className={`mt-1 size-3 shrink-0 rounded-full ${step.done ? "bg-lime" : "border border-line bg-panel-2"}`}
              aria-hidden="true"
            />
            <div>
              <p className={step.done ? "font-semibold" : "text-muted"}>
                {step.label}
                <span className="sr-only">{step.done ? " : fait" : " : à venir"}</span>
              </p>
              <p className="text-xs text-muted">
                {step.at === null ? "Jamais. C'est une simulation scolaire." : step.done ? time(step.at) : `Prévu le ${time(step.at)}`}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
