"use client";

// Accès à l'API depuis le front : chaque requête porte le JWT de l'API (session NextAuth) en Bearer.
import { createFilesClient } from "files-sdk/client";
import { signOut, useSession } from "next-auth/react";
import { useMemo } from "react";
import useSWR, { type SWRConfiguration } from "swr";
import type { ApiErrorBody, Me, Stats } from "./types";

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function apiFetch<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (typeof init.body === "string") headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers });
  // Token refusé (expiré, serveur redémarré…) : on repart de la page de connexion.
  if (response.status === 401) void signOut({ redirectTo: "/connexion" });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (data as ApiErrorBody | null)?.error;
    throw new ApiClientError(error?.code ?? "NETWORK", error?.message ?? "Le serveur ne répond pas.", response.status);
  }
  return data as T;
}

// Messages du routeur files-sdk (lib/upload-router.ts), en anglais, traduits pour l'interface.
const UPLOAD_ERRORS: Record<string, string> = {
  "only images, videos and audio can be uploaded": "Format refusé : image, vidéo ou audio attendu.",
  "file content is not the declared type": "Le contenu du fichier ne correspond pas à son format.",
  "upload exceeds maxUploadSize": "Fichier trop lourd.",
};

// Envoi d'un fichier par /api/files (presign, PUT, complete) ; renvoie sa clé, à passer à POST /api/posts
// ou à un message.
async function uploadFile(file: File, token: string): Promise<string> {
  const client = createFilesClient({ endpoint: "/api/files", headers: { Authorization: `Bearer ${token}` } });
  try {
    return (await client.upload(file)).key;
  } catch (error) {
    // Le client lève des FilesError ({code, message}), sans exporter la classe.
    if (!(error instanceof Error && "code" in error)) throw new ApiClientError("NETWORK", "Le serveur ne répond pas.", 0);
    if (error.code === "Unauthorized") void signOut({ redirectTo: "/connexion" });
    throw new ApiClientError("INVALID_INPUT", UPLOAD_ERRORS[error.message] ?? "Envoi du fichier impossible.", 400);
  }
}

const encode = (body: unknown) => (body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body));

// Actions (POST, PATCH, DELETE) liées au token de la session courante.
export function useApi() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  return useMemo(() => {
    const call = <T>(method: string, path: string, body?: unknown) => {
      if (!token) return Promise.reject(new ApiClientError("UNAUTHORIZED", "Session en cours de chargement.", 401));
      return apiFetch<T>(path, token, { method, body: encode(body) });
    };
    return {
      get: <T>(path: string) => call<T>("GET", path),
      post: <T>(path: string, body?: unknown) => call<T>("POST", path, body),
      patch: <T>(path: string, body?: unknown) => call<T>("PATCH", path, body),
      del: <T>(path: string) => call<T>("DELETE", path),
      upload: (file: File) =>
        token
          ? uploadFile(file, token)
          : Promise.reject(new ApiClientError("UNAUTHORIZED", "Session en cours de chargement.", 401)),
    };
  }, [token]);
}

// Lecture mise en cache (SWR). La clé est le chemin : `mutate("/api/me")` rafraîchit partout.
export function useApiData<T>(path: string | null, config?: SWRConfiguration<T, ApiClientError>) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  return useSWR<T, ApiClientError>(path && token ? path : null, (key: string) => apiFetch<T>(key, token!), config);
}

export const useMe = () => useApiData<{ user: Me; stats: Stats }>("/api/me");
