"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "@/components/icons";
import PostCard from "@/components/post-card";
import { useApiData } from "@/lib/api-client";
import type { PostView } from "@/lib/types";

// Page d'un post, ouverte depuis une grille de profil, la Recherche ou un lien partagé.
export default function PostDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data, error } = useApiData<{ post: PostView }>(`/api/posts/${encodeURIComponent(id)}`);

  // Ouvert depuis un lien partagé, il n'y a pas de page précédente dans l'app.
  const back = () => (window.history.length > 1 ? router.back() : router.push("/"));

  if (error?.status === 404 || error?.status === 400) {
    return (
      <div className="card flex flex-col items-center gap-3 p-6 text-center">
        <p className="font-display text-lg font-bold">Ce post n&apos;existe plus, ou il ne t&apos;est pas visible.</p>
        <Link href="/" className="btn-ghost">
          Retour au Flow
        </Link>
      </div>
    );
  }

  return (
    <>
      <header className="-mt-1 mb-3 flex items-center gap-2">
        <button type="button" onClick={back} aria-label="Retour" className="-ml-1 p-1">
          <ChevronLeftIcon />
        </button>
        <h1 className="font-display text-xl font-bold">{data?.post.isReel ? "Reel" : "Post"}</h1>
      </header>
      {data ? (
        <PostCard post={data.post} />
      ) : (
        <div className="aspect-square animate-pulse rounded-2xl bg-panel" aria-label="Chargement du post" />
      )}
    </>
  );
}
