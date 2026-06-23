"use client";

import { useCallback, useEffect, useState } from "react";
import { useCameraStream } from "@/hooks/use-camera-stream";
import { useVideoControls } from "@/hooks/use-video-controls";
import { captureVideoSnapshot } from "@/lib/capture-snapshot";
import { CameraStatusBadge } from "./camera-status-badge";
import { VideoControlsPanel } from "./video-controls-panel";
import type { CameraViewerItem } from "@/types/camera-viewer";
import { X, VolumeX, Volume2, Camera, Maximize2, History } from "lucide-react";
import Link from "next/link";

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
    cancelRetry,
    isAutoRetrying,
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
          <X className="w-5 h-5" />
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
            onTouchStart={controls.handleTouchStart}
            onTouchMove={controls.handleTouchMove}
            onTouchEnd={controls.handleTouchEnd}
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
                    {isAutoRetrying && (
                      <p className="text-white/30 text-xs">Reintentando cada 30s...</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={retry}
                        className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-all"
                      >
                        Reintentar
                      </button>
                      {isAutoRetrying && (
                        <button
                          type="button"
                          onClick={cancelRetry}
                          className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 text-sm transition-all"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
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
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
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
                  <Camera className="w-5 h-5" />
                </button>

                <Link
                  href={`/recordings?cameraId=${camera.id}`}
                  className="p-2 rounded-lg bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-all"
                  title="Ver grabaciones"
                >
                  <History className="w-5 h-5" />
                </Link>

                <button
                  type="button"
                  onClick={handleFullscreen}
                  className="p-2 rounded-lg bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-all ml-auto"
                  aria-label="Pantalla completa"
                >
                  <Maximize2 className="w-5 h-5" />
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
            className="w-full px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-sm transition-all inline-flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4" />
            Guardar snapshot
          </button>

          <Link
            href={`/recordings?cameraId=${camera.id}`}
            className="w-full px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-all inline-flex items-center justify-center gap-2"
          >
            <History className="w-4 h-4" />
            Ver grabaciones
          </Link>
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
