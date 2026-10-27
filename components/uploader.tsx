"use client";

import { useFiles } from "files-sdk/react";
import { useState } from "react";

export function Uploader() {
  const files = useFiles({ endpoint: "/api/files" });
  const [url, setUrl] = useState<string>();

  return (
    <div className="flex flex-col gap-2">
      <input
        type="file"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const { key } = await files.upload(file);
          setUrl(await files.url(key));
        }}
      />
      {files.isUploading && <progress value={files.progress.fraction} />}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </a>
      )}
    </div>
  );
}
