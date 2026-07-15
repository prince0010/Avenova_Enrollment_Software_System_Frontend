// Mirrors the backend's multer limits exactly (backend/src/middleware/upload.ts) —
// client-side validation is a UX nicety, not the security boundary; the
// backend still enforces these same numbers server-side regardless.
export const BIRTH_CERT_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

function toMB(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "");
}

// Returns an error message if the file exceeds maxBytes, otherwise null.
export function fileSizeError(file: File, maxBytes: number): string | null {
  if (file.size <= maxBytes) return null;
  return `File is ${toMB(file.size)}MB — exceeds the ${toMB(maxBytes)}MB limit. Choose a smaller file.`;
}
