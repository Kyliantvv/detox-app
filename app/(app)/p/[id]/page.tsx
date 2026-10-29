import { Suspense } from "react";
import PostDetail from "./post-detail";

async function PostLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostDetail id={id} />;
}

export default function PostPage({ params }: PageProps<"/p/[id]">) {
  return (
    <Suspense fallback={<div className="aspect-square animate-pulse rounded-2xl bg-panel" />}>
      <PostLoader params={params} />
    </Suspense>
  );
}
