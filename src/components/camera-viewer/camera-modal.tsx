"use client";

import { useCallback, useEffect, useState } from "react";
import { useCameraStream } from "@/hooks/use-camera-stream";
import { useVideoControls } from "@/hooks/use-video-controls";
import { captureVideoSnapshot } from "@/lib/capture-snapshot";
import { CameraStatusBadge } from "./camera-status-badge";
import { VideoControlsPanel } from "./video-controls-panel";
import type { CameraViewerItem } from "@/types/camera-viewer";

interface CameraModalProps {
  camera: CameraViewerItem;
  onClose: () => void;
}

export function CameraModal({ camera, onClose }: CameraModalProps) {
  const {
    state,
    errorMsg,
    videoRef,
    retry,
    isMuted,
    hasAudio,
    volume,
    toggleMute,
    setVolume,
  } = useCameraStream({
    cameraId: camera.id,
    streamType: "main",
    autoConnect: true,
    startMuted: true,
  });

  const controls = useVideoControls();
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null);

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

  const handleSnapshot = useCallback(async () => {
    const video = videoRef.current;
    if (!video || state !== "playing") return;
    try {
      const safeName = camera.name.replace(/[^\w.-]+/g, "_").slice(0, 40);
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      await captureVideoSnapshot(video, {
        filter: controls.filterStyle,
        filename: `${safeName}_${ts}.png`,
      });
      setSnapshotMsg("Captura guardada");
      setTimeout(() => setSnapshotMsg(null), 2500);
    } catch (err) {
      setSnapshotMsg(
        err instanceof Error ? err.message : "Error al capturar",
      );
      setTimeout(() => setSnapshotMsg(null), 3000);
    }
  }, [videoRef, state, camera.name, controls.filterStyle]);

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
              muted={isMuted}
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

            {snapshotMsg && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-lg bg-black/70 text-white text-xs">
                {snapshotMsg}
              </div>
            )}

            {state === "playing" && controls.state.zoom > 1 && (
              <div className="absolute top-4 left-4 px-2 py-1 rounded bg-black/60 text-white/80 text-xs">
                Zoom {controls.state.zoom.toFixed(1)}×
              </div>
            )}

            {state === "playing" && (
              <div className="absolute bottom-4 left-4 right-16 flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  disabled={!hasAudio}
                  title={
                    !hasAudio
                      ? "Esta cámara no envía audio"
                      : isMuted
                        ? "Activar sonido"
                        : "Silenciar"
                  }
                  className={[
                    "p-2 rounded-lg transition-all",
                    hasAudio
                      ? "bg-black/50 text-white/70 hover:text-white hover:bg-black/70"
                      : "bg-black/30 text-white/30 cursor-not-allowed",
                  ].join(" ")}
                  aria-label={isMuted ? "Activar sonido" : "Silenciar"}
                >
                  {isMuted ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25M9.75 9.75L5.25 5.25M5.25 5.25v13.5h3.75L14.25 19.5V4.5l-5.25 3v2.25z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12a7.5 7.5 0 01-7.5 7.5m7.5-7.5a7.5 7.5 0 00-7.5-7.5m7.5 7.5H3.75m0 0v-4.5m0 4.5v-4.5M9 9.75v4.5m0-4.5L5.25 5.25M9 9.75L12.75 12M9 14.25l3.75 2.25" />
                    </svg>
                  )}
                </button>

                {hasAudio && !isMuted && (
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(volume * 100)}
                    onChange={(e) => setVolume(Number(e.target.value) / 100)}
                    className="w-24 h-1 accent-white"
                    aria-label="Volumen"
                  />
                )}

                <button
                  type="button"
                  onClick={handleSnapshot}
                  className="p-2 rounded-lg bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-all"
                  aria-label="Capturar snapshot"
                  title="Guardar captura PNG"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={handleFullscreen}
                  className="p-2 rounded-lg bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-all ml-auto"
                  aria-label="Pantalla completa"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
              </div>
            )}
          </div>

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
              label="Audio"
              value={
                <span className="text-xs text-zinc-300">
                  {hasAudio ? (isMuted ? "Silenciado" : `${Math.round(volume * 100)}%`) : "Sin pista"}
                </span>
              }
            />
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

          <button
            type="button"
            onClick={handleSnapshot}
            disabled={state !== "playing"}
            className="w-full px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-sm transition-all"
          >
            📷 Guardar snapshot
          </button>
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
