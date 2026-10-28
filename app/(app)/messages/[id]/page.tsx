import { Suspense } from "react";
import Conversation from "./conversation";

async function ConversationLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Conversation userId={id} />;
}

export default function ConversationPage({ params }: PageProps<"/messages/[id]">) {
  return (
    <Suspense fallback={<div className="h-14 animate-pulse rounded-xl bg-panel" />}>
      <ConversationLoader params={params} />
    </Suspense>
  );
}
