"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type DocumentPreviewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; url: string; isPdf: boolean };

// Previews an uploaded document (image or PDF) in a modal. The caller owns
// fetching / object-URL lifecycle; PDFs render in an iframe, images in an img.
export function DocumentPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  document,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  document: DocumentPreviewState;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {document.status === "loading" && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
        {document.status === "error" && (
          <p className="text-sm text-destructive">{document.message}</p>
        )}
        {document.status === "ready" &&
          (document.isPdf ? (
            <iframe src={document.url} title={title} className="h-[70vh] w-full rounded-lg border" />
          ) : (
            // Blob object URL — next/image adds nothing here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={document.url}
              alt={title}
              className="max-h-[70vh] w-full rounded-lg border object-contain"
            />
          ))}
      </DialogContent>
    </Dialog>
  );
}
