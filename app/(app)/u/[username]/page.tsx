import { notFound } from "next/navigation";
import { Suspense } from "react";
import ProfileView from "@/components/profile-view";
import { FRIENDS, friendByUsername } from "@/lib/mock-data";

export function generateStaticParams() {
  return FRIENDS.map((friend) => ({ username: friend.username }));
}

async function ProfileLoader({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const friend = friendByUsername(decodeURIComponent(username));
  if (!friend) notFound();
  return <ProfileView friend={friend} />;
}

export default function PublicProfilePage({ params }: PageProps<"/u/[username]">) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-panel" />}>
      <ProfileLoader params={params} />
    </Suspense>
  );
}
