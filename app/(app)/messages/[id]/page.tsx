import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CONVERSATIONS } from "@/lib/mock-data";
import Conversation from "./conversation";

export function generateStaticParams() {
  return CONVERSATIONS.map((conversation) => ({ id: conversation.id }));
}

async function ConversationLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = CONVERSATIONS.find((item) => item.id === id);
  if (!conversation) notFound();
  return <Conversation conversationId={conversation.id} friendId={conversation.friendId} />;
}

export default function ConversationPage({ params }: PageProps<"/messages/[id]">) {
  return (
    <Suspense fallback={<div className="h-14 animate-pulse rounded-xl bg-panel" />}>
      <ConversationLoader params={params} />
    </Suspense>
  );
}
