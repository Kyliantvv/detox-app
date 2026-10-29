import { Suspense } from "react";
import OrderTracking from "./order-tracking";

async function OrderLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderTracking id={id} />;
}

export default function OrderPage({ params }: PageProps<"/epicerie/commandes/[id]">) {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse" aria-label="Chargement de la commande" />}>
      <OrderLoader params={params} />
    </Suspense>
  );
}
