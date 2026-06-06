"use client";

import { useCallback, useEffect } from "react";
import { useCameraStream } from "@/hooks/use-camera-stream";
import { useVideoControls } from "@/hooks/use-video-controls";
import { CameraStatusBadge } from "./camera-status-badge";
import { VideoControlsPanel } from "./video-controls-panel";
import type { CameraViewerItem } from "@/types/camera-viewer";

interface CameraModalProps {
  camera: CameraViewerItem;
  onClose: () => void;
}

/**
 * Full-screen camera modal with image controls (zoom, brightness, filters).
 */
export function CameraModal({ camera, onClose }: CameraModalProps) {
  const { state, errorMsg, videoRef, retry } = useCameraStream({
    cameraId: camera.id,
    streamType: "main",
    autoConnect: true,
  });

  const controls = useVideoControls();

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
    const el = videoRef.current?.parentElement?.parentElement;
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
      <div
        className="relative w-full h-full md:h-auto md:max-w-6xl md:rounded-2xl overflow-hidden bg-black flex flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
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
        <div className="relative flex-1 min-h-0 bg-black flex flex-col">
          <div
            className={[
              "relative flex-1 overflow-hidden touch-none",
              controls.state.zoom > 1 ? "cursor-grab active:cursor-grabbing" : "",
            ].join(" ")}
            onWheel={controls.handleWheel}
            onPointerDown={controls.handlePointerDown}
            onPointerMove={controls.handlePointerMove}
            onPointerUp={controls.handlePointerUp}
            onPointerCancel={controls.handlePointerUp}
            onDoubleClick={controls.handleDoubleClick}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={[
                "w-full h-full object-contain transition-opacity duration-300",
                state === "playing" ? "opacity-100" : "opacity-0",
              ].join(" ")}
              style={{
                filter: controls.filterStyle,
                transform: controls.transformStyle,
                transformOrigin: "center center",
              }}
              aria-label={`Stream principal de ${camera.name}`}
            />

            <CameraStatusBadge state={state} overlay />

            {state !== "playing" && (
              <div className="absolute inset-0 flex items-center justify-center">
                {state === "connecting" && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-12 w-12 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
                    <p className="text-white/50 text-sm">Conectando...</p>
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

            {state === "playing" && controls.state.zoom > 1 && (
              <div className="absolute top-4 left-4 px-2 py-1 rounded bg-black/60 text-white/80 text-xs">
                Zoom {controls.state.zoom.toFixed(1)}×
              </div>
            )}

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

          {/* Mobile controls */}
          <div className="md:hidden border-t border-zinc-800 p-4 bg-zinc-900 max-h-48 overflow-y-auto">
            <VideoControlsPanel
              brightness={controls.state.brightness}
              contrast={controls.state.contrast}
              saturation={controls.state.saturation}
              zoom={controls.state.zoom}
              preset={controls.state.preset}
              onBrightnessChange={controls.setBrightness}
              onContrastChange={controls.setContrast}
              onSaturationChange={controls.setSaturation}
              onZoomChange={controls.setZoom}
              onPresetChange={controls.applyPreset}
              onReset={controls.reset}
            />
          </div>
        </div>

        {/* Desktop controls panel */}
        <div className="hidden md:flex flex-col w-72 bg-zinc-900 p-5 gap-5 border-l border-zinc-800">
          <div>
            <h2 className="text-white font-semibold text-lg leading-tight">{camera.name}</h2>
            {camera.streamName && (
              <p className="text-zinc-500 text-xs font-mono mt-1 truncate">{camera.streamName}</p>
            )}
          </div>

          <div className="space-y-2">
            <InfoRow label="Estado" value={<CameraStatusBadge state={state} />} />
            <InfoRow
              label="Protocolo"
              value={
                <span className="font-mono text-xs text-zinc-300 uppercase">
                  {camera.protocol}
                </span>
              }
            />
          </div>

          <VideoControlsPanel
            brightness={controls.state.brightness}
            contrast={controls.state.contrast}
            saturation={controls.state.saturation}
            zoom={controls.state.zoom}
            preset={controls.state.preset}
            onBrightnessChange={controls.setBrightness}
            onContrastChange={controls.setContrast}
            onSaturationChange={controls.setSaturation}
            onZoomChange={controls.setZoom}
            onPresetChange={controls.applyPreset}
            onReset={controls.reset}
          />
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
