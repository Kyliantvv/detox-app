"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type ComponentType } from "react";
import { useSWRConfig } from "swr";
import Dialog from "@/components/dialog";
import { BoltIcon, CigaretteIcon, GiftIcon, SugarIcon, TicketIcon } from "@/components/icons";
import { ApiClientError, useApi, useApiData, useMe } from "@/lib/api-client";
import { POINTS } from "@/lib/game";
import { useApplyGains } from "@/lib/gains";
import type { PointsResponse, Purchase, ShopItem, ShopItemId } from "@/lib/types";

type PurchaseResult = { ok: false; reason: string } | ({ ok: true } & Purchase);

const ICONS: Record<ShopItemId, { Icon: ComponentType<{ size?: number }>; color: string }> = {
  sucre: { Icon: SugarIcon, color: "text-fg" },
  ticket: { Icon: TicketIcon, color: "text-lime" },
  lootbox: { Icon: GiftIcon, color: "text-pink" },
  cigarettes: { Icon: CigaretteIcon, color: "text-sun" },
};

// Catalogue : GET /api/shop. Achat : POST /api/orders (débit atomique et tirages côté serveur).
export default function GroceryPage() {
  const api = useApi();
  const applyGains = useApplyGains();
  const { mutate } = useSWRConfig();
  const { data: me } = useMe();
  const { data: shop } = useApiData<{ items: ShopItem[] }>("/api/shop");
  const router = useRouter();
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const [buying, setBuying] = useState(false);
  const close = useCallback(() => setResult(null), []);
  const points = me?.stats.points ?? 0;
  const pagesRead = me?.stats.flowPagesRead ?? 0;

  const buy = async (itemId: ShopItemId) => {
    setBuying(true);
    try {
      const purchase = await api.post<Purchase & PointsResponse>("/api/orders", { itemId });
      applyGains(purchase);
      void mutate("/api/orders");
      if (purchase.kind === "ticket") {
        await mutate("/api/ticket", { ticket: purchase.ticket }, { revalidate: false });
        router.push("/epicerie/jeux");
        return;
      }
      if (purchase.kind === "lootbox") void mutate("/api/ticket");
      setResult({ ok: true, ...purchase });
    } catch (error) {
      setResult({ ok: false, reason: error instanceof ApiClientError ? error.message : "Achat impossible." });
    } finally {
      setBuying(false);
    }
  };

  return (
    <>
      <section className="card flex items-center gap-3 px-4 py-3">
        <BoltIcon size={20} className="shrink-0 text-lime" />
        <div>
          <p className="font-semibold">
            +{pagesRead * POINTS.flowPage} pts gagnés en scrollant
          </p>
          <p className="text-sm text-muted">
            {pagesRead * 5} posts vus. Plus tu scrolles, plus tu peux t&apos;offrir.
          </p>
        </div>
      </section>

      <ul className="flex flex-col gap-3">
        {!shop && <li className="card h-64 animate-pulse" aria-label="Chargement des objets" />}
        {shop?.items.map((item) => {
          const { Icon, color } = ICONS[item.id];
          const affordable = points >= item.price;
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
                onClick={() => void buy(item.id)}
                disabled={buying}
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
        Mes commandes ({me?.stats.orders ?? 0})
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
