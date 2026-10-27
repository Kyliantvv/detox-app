"use client";

import { useFiles } from "files-sdk/react";
import { useState, type ChangeEvent } from "react";
import { IMAGE_TYPES } from "@/lib/image-types";

export function Uploader() {
  const files = useFiles({ endpoint: "/api/files" });
  const [url, setUrl] = useState<string>();
  const [busy, setBusy] = useState(false);

  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setUrl(undefined);
    setBusy(true);
    try {
      const { key } = await files.upload(file);
      setUrl(await files.url(key));
    } catch {
      // The hook keeps the failure in files.error, rendered below.
    } finally {
      // Clear the input so picking the same file again retries.
      input.value = "";
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        type="file"
        accept={IMAGE_TYPES.join(",")}
        // One upload at a time, or an earlier, slower one could show its link
        // after the file picked last.
        disabled={busy}
        onChange={(e) => void onChange(e)}
      />
      {files.isUploading && <progress value={files.progress.fraction} />}
      {files.error && (
        <p className="text-sm text-red-600">
          {files.error.code}: {files.error.message}
        </p>
      )}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </a>
      )}
    </div>
  );
}
