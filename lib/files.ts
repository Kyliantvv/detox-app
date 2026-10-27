import { createFiles } from "files-sdk";
import { uploadthing } from "files-sdk/uploadthing";

// UPLOADTHING_TOKEN is read from the environment.
export const files = createFiles({ adapter: uploadthing() });
