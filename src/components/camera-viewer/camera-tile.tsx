"use client";

import { useEffect, useRef, useCallback, memo, useState } from "react";
import { useCameraStream } from "@/hooks/use-camera-stream";
import { CameraStatusBadge } from "./camera-status-badge";
import type { CameraViewerItem, StreamType } from "@/types/camera-viewer";

interface CameraTileProps {
  camera: CameraViewerItem;
  streamType?: StreamType;
  onClick?: (camera: CameraViewerItem) => void;
  /** Page key — when this changes, tile fully remounts = WebRTC disconnects */
  pageKey: number;
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
  streamType = "sub",
  onClick,
}: CameraTileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, errorMsg, videoRef, connect, disconnect, retry } = useCameraStream({
    cameraId: camera.id,
    streamType,
  });

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
        aria-label={`Stream de ${camera.name}`}
      />

      {/* Status badge — top right */}
      <CameraStatusBadge state={state} overlay />

      {/* Center overlay for non-playing states */}
      {state !== "playing" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          {state === "connecting" && (
            <>
              <div className="h-8 w-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              <p className="text-white/60 text-xs">Conectando...</p>
            </>
          )}
          {state === "offline" && (
            <>
              <div className="text-white/20 text-4xl">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72M15.75 10.5H11m4.75 0V5.75M4.5 19.5l15-15M8.25 6.75H4.5m3.75 0V10.5m0-3.75a3 3 0 013 3m0 0v3.75m0-3.75H12" />
                </svg>
              </div>
              <p className="text-white/40 text-xs font-medium">Sin señal</p>
            </>
          )}
          {state === "idle" && camera.online && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); connect(); }}
              className="flex flex-col items-center gap-2 text-white/40 hover:text-white/80 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                <path d="M8 5.14v14l11-7-11-7z" />
              </svg>
              <span className="text-[10px]">Reproducir</span>
            </button>
          )}
          {state === "error" && (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-red-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
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
      </div>

      {/* Timestamp — top left when playing */}
      {state === "playing" && <LiveTimestamp />}

      {/* Expand icon on hover */}
      {onClick && (
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="p-1 rounded bg-black/50 backdrop-blur-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-3.5 h-3.5 opacity-70">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </div>
        </div>
      )}
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
    <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <span className="text-[10px] text-white/70 font-mono bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded">
        {time}
      </span>
    </div>
  );
}
