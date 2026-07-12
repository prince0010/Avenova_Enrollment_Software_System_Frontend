"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type EscortImageState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; url: string };

// Shows one escort's details plus their ID image. The caller owns fetching /
// object-URL lifecycle; this component just renders whatever state it's given
// (used both pre-submit with local Files and post-create with fetched blobs).
export function EscortDetailDialog({
  open,
  onOpenChange,
  name,
  phoneNumber,
  image,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  phoneNumber: string | null;
  image: EscortImageState;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escort details</DialogTitle>
          <DialogDescription>Escort / custody information and ID image.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{name}</dd>
          <dt className="text-muted-foreground">Phone number</dt>
          <dd>{phoneNumber || "Not provided"}</dd>
        </dl>
        {image.status === "none" && (
          <p className="text-sm text-muted-foreground">No ID image on file.</p>
        )}
        {image.status === "loading" && (
          <p className="text-sm text-muted-foreground">Loading ID image...</p>
        )}
        {image.status === "error" && (
          <p className="text-sm text-destructive">{image.message}</p>
        )}
        {image.status === "ready" && (
          // Blob object URL — next/image adds nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={`${name} ID`}
            className="max-h-[60vh] w-full rounded-lg border object-contain"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
