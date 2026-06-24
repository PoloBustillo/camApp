"use client";

import { useEffect, useRef, useCallback, memo, useMemo } from "react";
import { useCameraStream } from "@/hooks/use-camera-stream";
import { CameraStatusBadge } from "./camera-status-badge";
import type { CameraViewerItem, StreamType, PersistedFilters } from "@/types/camera-viewer";
import { PRESET_LABELS } from "@/types/camera-viewer";
import { SlidersHorizontal } from "lucide-react";

interface CameraTileProps {
  camera: CameraViewerItem;
  filters?: PersistedFilters | null;
  streamType?: StreamType;
  onClick?: (camera: CameraViewerItem) => void;
  /** Use WHEP/HTTP signaling instead of WebSocket (better for TV browsers) */
  preferWhep?: boolean;
}

function buildFilterStyle(filters: PersistedFilters | null | undefined): string {
  if (!filters) return "none";
  const { brightness, contrast, saturation, preset } = filters;
  const isDefault =
    brightness === 100 && contrast === 100 && saturation === 100 && preset === "normal";
  if (isDefault) return "none";

  const parts = [
    `brightness(${brightness / 100})`,
    `contrast(${contrast / 100})`,
    `saturate(${saturation / 100})`,
  ];
  if (preset === "night-vision") parts.push("hue-rotate(80deg)");
  if (preset === "warm") parts.push("sepia(0.2)");
  if (preset === "cool") parts.push("hue-rotate(180deg)");
  if (preset === "invert") parts.push("invert(1)");
  return parts.join(" ");
}

/**
 * CameraTile — renders one camera in the grid mosaic.
 *
 * Minimal view-only tile:
 * - Status badge
 * - Camera name / site
 * - Filter indicator
 * - Click opens the detail modal
 *
 * Recording, audio, fullscreen, favorite, and retry actions live in CameraModal.
 */
export const CameraTile = memo(function CameraTile({
  camera,
  filters,
  streamType = "sub",
  onClick,
  preferWhep = false,
}: CameraTileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, errorMsg, videoRef, connect, disconnect, isAutoRetrying, isFrozen } = useCameraStream({
    cameraId: camera.id,
    streamType,
    preferWhep,
  });

  const filterStyle = useMemo(() => buildFilterStyle(filters), [filters]);

  const hasCustomFilter = useMemo(() => {
    if (!filters) return false;
    return filters.preset !== "normal" ||
      filters.brightness !== 100 ||
      filters.contrast !== 100 ||
      filters.saturation !== 100;
  }, [filters]);

  const presetLabel = useMemo(() => {
    if (!filters) return "";
    return PRESET_LABELS[filters.preset] ?? filters.preset;
  }, [filters]);

  const connectRef = useRef(connect);
  connectRef.current = connect;
  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;
  const stateRef = useRef(state);
  stateRef.current = state;

  // IntersectionObserver: connect when visible, disconnect when hidden.
  // Uses refs for connect/disconnect so the effect never re-runs.
  useEffect(() => {
    if (!camera.online || !camera.enabled) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (stateRef.current === "idle" || stateRef.current === "reconnecting" || stateRef.current === "offline" || stateRef.current === "error") {
            connectRef.current();
          }
        } else {
          disconnectRef.current();
        }
      },
      { threshold: 0.05, rootMargin: "100px" },
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
    };
  }, [camera.online, camera.enabled]);

  const handleClick = useCallback(() => {
    onClick?.(camera);
  }, [onClick, camera]);

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && handleClick() : undefined}
      className={[
        "relative bg-black rounded-xl overflow-hidden aspect-video group",
        "ring-1 ring-white/10",
        onClick ? "cursor-pointer hover:ring-white/30 transition-all duration-200" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid={`camera-tile-${camera.id}`}
    >
      {/* Video element — always rendered, src changes */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={[
          "w-full h-full object-cover",
          state === "playing" ? "opacity-100" : "opacity-0",
        ].join(" ")}
        style={{ filter: filterStyle }}
        aria-label={`Stream de ${camera.name}`}
      />

      {/* Status badge — top right */}
      <CameraStatusBadge state={state} isFrozen={isFrozen} overlay />

      {/* Center overlay for non-playing states */}
      {state !== "playing" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          {state === "connecting" && (
            <>
              <div className="h-8 w-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              <p className="text-white/60 text-xs">Conectando...</p>
            </>
          )}
          {state === "reconnecting" && (
            <>
              <div className="h-8 w-8 rounded-full border-2 border-orange-300/30 border-t-orange-400 animate-spin" />
              <p className="text-white/60 text-xs text-center px-4">{errorMsg ?? "Reconectando..."}</p>
            </>
          )}
          {state === "offline" && (
            <>
              <p className="text-white/40 text-xs font-medium">Sin señal</p>
              {isAutoRetrying && (
                <p className="text-white/30 text-[10px]">Reintentando cada 30s...</p>
              )}
            </>
          )}
          {state === "idle" && camera.online && (
            <p className="text-white/40 text-xs">Toca para conectar</p>
          )}
          {state === "error" && (
            <p className="text-white/40 text-[10px] text-center px-4 max-w-[120px]">{errorMsg}</p>
          )}
        </div>
      )}

      {/* Bottom info bar — always visible, dims on hover */}
      <div className={[
        "absolute bottom-0 left-0 right-0 px-3 py-2",
        "bg-gradient-to-t from-black/80 via-black/40 to-transparent",
        "transition-opacity duration-300",
        state === "playing" ? "opacity-0 group-hover:opacity-100" : "opacity-100",
      ].join(" ")}>
        <p className="text-white text-xs font-semibold truncate leading-tight">{camera.name}</p>
        {camera.siteName && (
          <p className="text-white/50 text-[10px] truncate">{camera.siteName}</p>
        )}
        {hasCustomFilter && (
          <div className="flex items-center gap-1 mt-0.5">
            <SlidersHorizontal className="w-2.5 h-2.5 text-white/40" />
            <span className="text-[9px] text-white/40">{presetLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
});
