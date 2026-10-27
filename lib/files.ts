import { createFiles, type Files } from "files-sdk";
import { uploadthing } from "files-sdk/uploadthing";

let files: Files | undefined;

// Created on first request, not at import: uploadthing() throws without
// UPLOADTHING_TOKEN, which would fail `next build` wherever it's unset.
export const getFiles = () =>
  (files ??= createFiles({ adapter: uploadthing() }));
