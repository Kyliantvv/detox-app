"use client";

import Link from "next/link";
import { useDetox } from "@/lib/store";

// TODO API : GET /api/orders.
export default function OrdersPage() {
  const { orders } = useDetox();

  return (
    <>
      <h2 className="font-display text-xl font-bold">Mes commandes</h2>
      {orders.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-6 text-center">
          <p className="font-semibold">Aucune commande pour l&apos;instant.</p>
          <p className="text-sm text-muted">Ton premier sachet de sucre t&apos;attend. Enfin, il n&apos;arrivera pas.</p>
          <Link href="/epicerie" className="btn-sun">
            Voir les objets
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id} className="card flex flex-col gap-1.5 p-4">
              <div className="flex items-center justify-between">
                <p className="font-display font-bold">{order.itemName}</p>
                <span className="text-sm text-muted">{order.price} pts</span>
              </div>
              <p className="font-pixel text-[10px] text-lime">{order.tracking}</p>
              <p className="text-sm text-muted">{order.address}</p>
              <p className="text-sm font-semibold text-sun">Ton colis est en route · depuis toujours</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
