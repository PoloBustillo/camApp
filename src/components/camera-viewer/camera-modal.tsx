"use client";

import { useCallback, useEffect } from "react";
import { useCameraStream } from "@/hooks/use-camera-stream";
import { CameraStatusBadge } from "./camera-status-badge";
import type { CameraViewerItem } from "@/types/camera-viewer";

interface CameraModalProps {
  camera: CameraViewerItem;
  onClose: () => void;
}

/**
 * Full-screen camera modal.
 *
 * Design decisions:
 * - Uses "main" stream (1080p) instead of substream
 * - Shows camera metadata sidebar on desktop, overlaid on mobile
 * - Closes on Escape key or clicking backdrop
 * - Prevents scroll on body while open
 */
export function CameraModal({ camera, onClose }: CameraModalProps) {
  const { state, errorMsg, videoRef, retry } = useCameraStream({
    cameraId: camera.id,
    streamType: "main",
    autoConnect: true,
  });

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleFullscreen = useCallback(async () => {
    const el = videoRef.current?.parentElement;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }, [videoRef]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-0 md:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label={camera.name}
    >
      {/* Inner container — stops click propagation */}
      <div
        className="relative w-full h-full md:h-auto md:max-w-5xl md:rounded-2xl overflow-hidden bg-black flex flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/60 text-white/70 hover:text-white hover:bg-black/80 transition-all"
          aria-label="Cerrar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Video area */}
        <div className="relative flex-1 aspect-video md:aspect-auto min-h-0 bg-black">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={[
              "w-full h-full object-contain",
              state === "playing" ? "opacity-100" : "opacity-0",
            ].join(" ")}
            aria-label={`Stream principal de ${camera.name}`}
          />

          <CameraStatusBadge state={state} overlay />

          {/* Center state overlay */}
          {state !== "playing" && (
            <div className="absolute inset-0 flex items-center justify-center">
              {state === "connecting" && (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-12 w-12 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
                  <p className="text-white/50 text-sm">Conectando en alta definición...</p>
                </div>
              )}
              {(state === "error" || state === "offline") && (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-white/50">{errorMsg ?? "Cámara no disponible"}</p>
                  {state === "error" && (
                    <button
                      type="button"
                      onClick={retry}
                      className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-all"
                    >
                      Reintentar
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Fullscreen button */}
          {state === "playing" && (
            <button
              type="button"
              onClick={handleFullscreen}
              className="absolute bottom-4 right-4 p-2 rounded-lg bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-all"
              aria-label="Pantalla completa"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          )}
        </div>

        {/* Info panel */}
        <div className="hidden md:flex flex-col w-64 bg-zinc-900 p-5 gap-4">
          <div>
            <h2 className="text-white font-semibold text-lg leading-tight">{camera.name}</h2>
            {camera.siteName && (
              <p className="text-zinc-400 text-sm mt-1">{camera.siteName}</p>
            )}
          </div>

          <div className="space-y-3">
            <InfoRow label="Estado" value={<CameraStatusBadge state={state} />} />
            <InfoRow label="Protocolo" value={<span className="font-mono text-xs text-zinc-300 uppercase">{camera.protocol}</span>} />
            <InfoRow label="Stream" value={<span className="text-xs text-zinc-400">Principal (1080p)</span>} />
            {camera.streamName && (
              <InfoRow label="Path" value={<span className="font-mono text-xs text-zinc-500 truncate">{camera.streamName}</span>} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-zinc-500 text-xs shrink-0">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
