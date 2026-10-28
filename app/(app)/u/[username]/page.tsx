import { Suspense } from "react";
import ProfileView from "@/components/profile-view";

async function ProfileLoader({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <ProfileView username={decodeURIComponent(username)} />;
}

export default function PublicProfilePage({ params }: PageProps<"/u/[username]">) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-panel" />}>
      <ProfileLoader params={params} />
    </Suspense>
  );
}
