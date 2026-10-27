"use client";

import { useFiles } from "files-sdk/react";
import { useState, type ChangeEvent } from "react";

export function Uploader() {
  const files = useFiles({ endpoint: "/api/files" });
  const [url, setUrl] = useState<string>();

  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setUrl(undefined);
    try {
      const { key } = await files.upload(file);
      setUrl(await files.url(key));
    } catch {
      // The hook keeps the failure in files.error, rendered below.
    } finally {
      // Clear the input so picking the same file again retries.
      input.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        type="file"
        accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
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
