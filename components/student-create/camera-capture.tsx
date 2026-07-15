"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function cameraErrorMessage(err: unknown) {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") {
      return "Camera access was denied. Allow camera access in the browser and try again.";
    }
    if (err.name === "NotFoundError") {
      return "No camera was found on this device.";
    }
  }
  return "Could not start the camera. Please try again.";
}

export function CameraCapture({ onCapture }: { onCapture: (file: File) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      return;
    }
    let cancelled = false;
    setError(null);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        if (!cancelled) setError(cameraErrorMessage(err));
      });
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, stopStream]);

  function handleCapture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], "student-photo.jpg", { type: "image/jpeg" }));
        setOpen(false);
      },
      "image/jpeg",
      0.9
    );
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Camera /> Take photo
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Take photo</DialogTitle>
            <DialogDescription>
              Position the student in the frame, then capture.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            // Muted + playsInline so autoplay works without user gesture in
            // all Chromium contexts (browser and the Electron shell).
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video w-full rounded-lg bg-muted object-cover"
            />
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCapture} disabled={!!error}>
              Capture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
