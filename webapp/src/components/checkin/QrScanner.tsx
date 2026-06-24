import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QrScannerProps {
  // Called with the decoded QR text (the ticket's qr_token UUID).
  onDecode: (text: string) => void;
  // Pause decoding while a scan is being processed / a result is shown.
  paused?: boolean;
}

type CamState = "idle" | "starting" | "running" | "denied" | "error";

// Live camera QR scanner. Mobile-first: fills its container and works down to
// 375px. Camera permission is requested only when the host taps "Start camera",
// and a denial degrades gracefully to a clear message (manual entry still works).
export function QrScanner({ onDecode, paused }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const pausedRef = useRef<boolean>(!!paused);
  const [state, setState] = useState<CamState>("idle");

  useEffect(() => {
    pausedRef.current = !!paused;
  }, [paused]);

  function stop() {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }

  async function start() {
    setState("starting");
    try {
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromVideoDevice(
        undefined, // default device; the browser picks the rear camera on mobile
        videoRef.current ?? undefined,
        (result) => {
          if (result && !pausedRef.current) {
            onDecode(result.getText());
          }
        },
      );
      controlsRef.current = controls;
      setState("running");
    } catch (err) {
      const name = (err as { name?: string })?.name;
      setState(name === "NotAllowedError" || name === "NotReadableError" ? "denied" : "error");
    }
  }

  // Clean up the camera on unmount.
  useEffect(() => {
    return () => stop();
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-black/90">
        {/* The video element is always mounted so zxing can attach to it. */}
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
        />

        {/* Framing reticle */}
        {state === "running" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-2/3 w-2/3 rounded-2xl border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        ) : null}

        {state === "idle" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <Camera className="h-10 w-10 opacity-90" />
            <p className="text-sm opacity-90">Scan a guest's ticket QR to check them in.</p>
            <Button onClick={start} className="min-h-[44px]">
              <Camera className="h-4 w-4" />
              Start camera
            </Button>
          </div>
        ) : null}

        {state === "starting" ? (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        ) : null}

        {state === "denied" || state === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <CameraOff className="h-10 w-10 opacity-90" />
            <p className="text-sm opacity-90">
              {state === "denied"
                ? "Camera access was blocked. Use manual entry below, or enable the camera in your browser settings."
                : "Couldn't start the camera. Use manual entry below."}
            </p>
            <Button variant="secondary" onClick={start} className="min-h-[44px]">
              Try again
            </Button>
          </div>
        ) : null}
      </div>

      {state === "running" ? (
        <Button variant="outline" onClick={() => { stop(); setState("idle"); }} className="w-full">
          <CameraOff className="h-4 w-4" />
          Stop camera
        </Button>
      ) : null}
    </div>
  );
}
