"use client";

import { useEffect, useRef, useCallback, memo, useMemo, useState } from "react";
import { useCameraStream } from "@/hooks/use-camera-stream";
import { CameraStatusBadge } from "./camera-status-badge";
import type { CameraViewerItem, StreamType, PersistedFilters } from "@/types/camera-viewer";
import { PRESET_LABELS } from "@/types/camera-viewer";
import { Star, WifiOff, TriangleAlert, Play, SlidersHorizontal } from "lucide-react";

interface CameraTileProps {
  camera: CameraViewerItem;
  filters?: PersistedFilters | null;
  streamType?: StreamType;
  onClick?: (camera: CameraViewerItem) => void;
  /** Page key — when this changes, tile fully remounts = WebRTC disconnects */
  pageKey: number;
  isFavorite?: boolean;
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
 * Key design decisions:
 * - IntersectionObserver: only maintains WebRTC connection when tile is visible
 *   in viewport. This prevents wasted bandwidth for off-screen cameras.
 * - Memoized with React.memo to prevent re-renders from parent state changes.
 * - pageKey changes cause full remount (new React key in parent) which triggers
 *   cleanup of all WebRTC connections from the previous page.
 * - Grid mode always uses "sub" stream (640x360, 10-15fps) for efficiency.
 */
export const CameraTile = memo(function CameraTile({
  camera,
  filters,
  streamType = "sub",
  onClick,
  isFavorite: initialFavorite,
}: CameraTileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, errorMsg, videoRef, connect, disconnect, retry, cancelRetry, isAutoRetrying } = useCameraStream({
    cameraId: camera.id,
    streamType,
  });

  const [favorited, setFavorited] = useState(
    initialFavorite ?? camera.isFavorite ?? false,
  );

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

  // IntersectionObserver: connect when visible, disconnect when hidden
  useEffect(() => {
    if (!camera.online || !camera.enabled) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          connect();
        } else {
          disconnect();
        }
      },
      { threshold: 0.1 },
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [camera.online, camera.enabled, connect, disconnect]);

  const handleClick = useCallback(() => {
    onClick?.(camera);
  }, [onClick, camera]);

  const handleFavoriteToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const next = !favorited;
      setFavorited(next);
      try {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cameraId: camera.id }),
        });
      } catch {
        // revert on error
        setFavorited(!next);
      }
    },
    [favorited, camera.id],
  );

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
      <CameraStatusBadge state={state} overlay />

      {/* Favorite star — top left */}
      <button
        type="button"
        onClick={handleFavoriteToggle}
        className={[
          "absolute top-2 left-2 z-10 p-1 rounded-full backdrop-blur-sm transition-all",
          "opacity-0 group-hover:opacity-100",
          favorited
            ? "opacity-100 text-yellow-400 bg-black/40"
            : "text-white/40 bg-black/20 hover:text-yellow-300",
        ].join(" ")}
        aria-label={favorited ? "Quitar de favoritas" : "Añadir a favoritas"}
      >
        <Star
          className="w-3.5 h-3.5"
          fill={favorited ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
        />
      </button>

      {/* Center overlay for non-playing states */}
      {state !== "playing" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
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
              <div className="text-white/20 text-4xl">
                <WifiOff className="w-10 h-10" />
              </div>
              <p className="text-white/40 text-xs font-medium">Sin señal</p>
              {isAutoRetrying && (
                <p className="text-white/30 text-[10px] mt-1">Reintentando cada 30s...</p>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); retry(); }}
                  className="text-[10px] px-3 py-1 rounded border border-white/20 text-white/50 hover:text-white hover:border-white/50 transition-all"
                >
                  Reintentar
                </button>
                {isAutoRetrying && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); cancelRetry(); }}
                    className="text-[10px] px-3 py-1 rounded border border-white/10 text-white/30 hover:text-white/60 hover:border-white/30 transition-all"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </>
          )}
          {state === "idle" && camera.online && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); connect(); }}
              className="flex flex-col items-center gap-2 text-white/40 hover:text-white/80 transition-colors"
            >
              <Play className="w-8 h-8" />
              <span className="text-[10px]">Reproducir</span>
            </button>
          )}
          {state === "error" && (
            <>
              <TriangleAlert className="w-8 h-8 text-red-400" />
              <p className="text-white/40 text-[10px] text-center px-4 max-w-[120px]">{errorMsg}</p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); retry(); }}
                className="text-[10px] px-3 py-1 rounded border border-white/20 text-white/50 hover:text-white hover:border-white/50 transition-all"
              >
                Reintentar
              </button>
            </>
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

      {/* Timestamp — top left when playing */}
      {state === "playing" && <LiveTimestamp />}
    </div>
  );
});

/** Shows current time, updates every second */
function LiveTimestamp() {
  const fmt = () => new Date().toLocaleTimeString("es-MX", { hour12: false });
  const [time, setTime] = useState(fmt);

  useEffect(() => {
    const id = setInterval(() => setTime(fmt), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="absolute top-2 right-16 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <span className="text-[10px] text-white/70 font-mono bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded">
        {time}
      </span>
    </div>
  );
}
