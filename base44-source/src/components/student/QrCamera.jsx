import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CameraOff, RefreshCw } from "lucide-react";
import { createQrDecoder } from "@/lib/qrDecode";

const DEDUPE_MS = 4000;

export default function QrCamera({ onScan, paused = false, className = "", onStatusChange }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const onScanRef = useRef(onScan);
  const pausedRef = useRef(paused);
  const lastRef = useRef({ value: "", at: 0 });
  const [status, setStatus] = useState("starting");
  const [attempt, setAttempt] = useState(0);

  const onStatusRef = useRef(onStatusChange);

  onScanRef.current = onScan;
  pausedRef.current = paused;
  onStatusRef.current = onStatusChange;

  useEffect(() => {
    if (onStatusRef.current) onStatusRef.current(status);
  }, [status]);

  useEffect(() => {
    let cancelled = false;

    const emit = (raw) => {
      const value = (raw || "").trim();
      if (!value || pausedRef.current) return;
      const now = Date.now();
      if (value === lastRef.current.value && now - lastRef.current.at < DEDUPE_MS) return;
      lastRef.current = { value, at: now };
      if (onScanRef.current) onScanRef.current(value);
    };

    const start = async () => {
      setStatus("starting");
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("unsupported");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus("live");

        let decoder = null;
        try {
          decoder = await createQrDecoder();
        } catch {
          decoder = null;
        }
        if (cancelled) return;
        if (!decoder) {
          setStatus("no-decoder");
          return;
        }

        const tick = async () => {
          if (cancelled) return;
          const video = videoRef.current;
          try {
            if (video && video.readyState >= 2) {
              const value = await decoder.detect(video);
              if (value) emit(value);
            }
          } catch {
            /* a missed frame is harmless */
          }
          timerRef.current = setTimeout(tick, 300);
        };
        timerRef.current = setTimeout(tick, 300);
      } catch (err) {
        if (!cancelled) {
          const denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
          setStatus(denied ? "blocked" : "unavailable");
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [attempt]);

  const off = status === "blocked" || status === "unavailable";

  return (
    <div className={"relative overflow-hidden rounded-xl bg-slate-900 " + className}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={"h-full w-full object-cover " + (off ? "invisible" : "")}
      />

      {!off && (
        <>
          <div className="pointer-events-none absolute inset-0">
            <span className="absolute left-3 top-3 h-6 w-6 rounded-tl-md border-l-2 border-t-2 border-white/80" />
            <span className="absolute right-3 top-3 h-6 w-6 rounded-tr-md border-r-2 border-t-2 border-white/80" />
            <span className="absolute bottom-3 left-3 h-6 w-6 rounded-bl-md border-b-2 border-l-2 border-white/80" />
            <span className="absolute bottom-3 right-3 h-6 w-6 rounded-br-md border-b-2 border-r-2 border-white/80" />
          </div>
          <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
            {status === "live" && "Scanning QR codes…"}
            {status === "starting" && "Starting camera…"}
            {status === "no-decoder" && "Camera on, but the QR decoder could not load. Type the code below."}
          </span>
        </>
      )}

      {off && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
          <CameraOff className="h-5 w-5 text-white/80" />
          <p className="text-xs text-white/80">
            {status === "blocked"
              ? "Camera permission is required. Allow camera access for this page, then try again."
              : "No camera is available on this device. Use the scanner or type the code."}
          </p>
          <Button size="sm" variant="secondary" onClick={() => setAttempt((a) => a + 1)}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Retry camera
          </Button>
        </div>
      )}
    </div>
  );
}
