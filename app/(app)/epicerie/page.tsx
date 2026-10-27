"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type ComponentType } from "react";
import Dialog from "@/components/dialog";
import { BoltIcon, CigaretteIcon, GiftIcon, SugarIcon, TicketIcon } from "@/components/icons";
import { SHOP_ITEMS } from "@/lib/mock-data";
import { buyItem, POINTS, useDetox, type PurchaseResult } from "@/lib/store";
import type { ShopItemId } from "@/lib/types";

const ICONS: Record<ShopItemId, { Icon: ComponentType<{ size?: number }>; color: string }> = {
  sucre: { Icon: SugarIcon, color: "text-fg" },
  ticket: { Icon: TicketIcon, color: "text-lime" },
  lootbox: { Icon: GiftIcon, color: "text-pink" },
  cigarettes: { Icon: CigaretteIcon, color: "text-sun" },
};

// TODO API : GET /api/shop pour la liste, POST /api/orders pour acheter (débit atomique côté serveur).
export default function GroceryPage() {
  const state = useDetox();
  const router = useRouter();
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const close = useCallback(() => setResult(null), []);

  const buy = (itemId: ShopItemId) => {
    const outcome = buyItem(itemId);
    if (outcome.ok && outcome.kind === "ticket") {
      router.push("/epicerie/jeux");
      return;
    }
    setResult(outcome);
  };

  return (
    <>
      <section className="card flex items-center gap-3 px-4 py-3">
        <BoltIcon size={20} className="shrink-0 text-lime" />
        <div>
          <p className="font-semibold">
            +{state.flowPagesRead.length * POINTS.flowPage} pts gagnés en scrollant aujourd&apos;hui
          </p>
          <p className="text-sm text-muted">
            {state.flowPagesRead.length * 5} posts vus. Plus tu scrolles, plus tu peux t&apos;offrir.
          </p>
        </div>
      </section>

      <ul className="flex flex-col gap-3">
        {SHOP_ITEMS.map((item) => {
          const { Icon, color } = ICONS[item.id];
          const affordable = state.points >= item.price;
          return (
            <li key={item.id} className="card flex items-center gap-4 p-4">
              <span className={`grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-ink ${color}`}>
                <Icon size={24} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[17px] font-bold">{item.name}</p>
                <p className="text-sm text-muted">{item.description}</p>
                <p className="mt-0.5 text-xs text-muted/70 italic">simulation scolaire</p>
              </div>
              <button
                type="button"
                onClick={() => buy(item.id)}
                className={`btn shrink-0 px-3 text-[15px] ${affordable ? "bg-sun text-ink" : "border border-line bg-panel-2 text-muted"}`}
                aria-label={`Acheter ${item.name} pour ${item.price} points`}
              >
                {item.price} pts
              </button>
            </li>
          );
        })}
      </ul>

      <Link href="/epicerie/commandes" className="btn-ghost">
        Mes commandes ({state.orders.length})
      </Link>

      {result && !result.ok && (
        <Dialog title="Solde insuffisant" onClose={close}>
          <p className="text-muted">{result.reason}</p>
          <Link href="/" className="btn-lime mt-5 w-full" onClick={close}>
            Aller scroller
          </Link>
        </Dialog>
      )}
      {result?.ok && result.kind === "order" && (
        <Dialog title="Commande confirmée" onClose={close}>
          <div className="flex flex-col gap-3">
            <p className="text-lg font-semibold">{result.order.itemName}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Suivi</dt>
              <dd className="font-pixel text-[11px] leading-5 text-lime">{result.order.tracking}</dd>
              <dt className="text-muted">Livraison</dt>
              <dd>{result.order.address}</dd>
              <dt className="text-muted">Statut</dt>
              <dd className="font-semibold text-sun">Ton colis est en route</dd>
            </dl>
            <p className="rounded-xl border border-line bg-panel-2 p-3 text-sm text-muted">
              Il n&apos;arrivera jamais. C&apos;est une simulation scolaire : rien n&apos;est livré.
            </p>
            <button type="button" className="btn-sun" onClick={close}>
              Continuer mes achats
            </button>
          </div>
        </Dialog>
      )}
      {result?.ok && result.kind === "lootbox" && (
        <Dialog title="Loot box ouverte" onClose={close}>
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <GiftIcon size={48} />
            <p className="font-display text-2xl font-bold text-sun">{result.prize}</p>
            <p className="text-sm text-muted">Une autre ? Le prochain tirage sera peut-être le bon.</p>
            <button type="button" className="btn-pink w-full" onClick={close}>
              Fermer
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
