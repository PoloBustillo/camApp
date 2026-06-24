"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Play, Pause, LogOut, RefreshCw } from "lucide-react";
import { CameraTile } from "./camera-tile";
import type { CameraViewerItem } from "@/types/camera-viewer";

interface KioskGridProps {
  cameras: CameraViewerItem[];
  /** Auto-cycle pages every N seconds (default 15) */
  cycleInterval?: number;
}

interface GridConfig {
  cols: number;
  pageSize: number;
  gap: string;
  padding: string;
}

function getGridConfig(width: number, height: number): GridConfig {
  if (width >= 3840 || height >= 2160) {
    return { cols: 3, pageSize: 9, gap: "gap-0.5", padding: "p-0.5" };
  }
  return { cols: 2, pageSize: 4, gap: "gap-1", padding: "p-1" };
}

/**
 * KioskGrid — TV/Kiosk mode.
 * - Auto-adapts grid layout based on screen resolution (2x2 for FHD, 3x3 for 4K).
 * - Auto-cycles through pages of cameras.
 * - Space bar toggles play/pause.
 * - Controls appear on mouse move, hide after 3s.
 * - ESC → redirect to /dashboard.
 */
export function KioskGrid({
  cameras,
  cycleInterval = 15_000,
}: KioskGridProps) {
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Grid config based on resolution
  const [gridConfig, setGridConfig] = useState<GridConfig>(() =>
    typeof window !== "undefined"
      ? getGridConfig(window.innerWidth, window.innerHeight)
      : { cols: 2, pageSize: 4, gap: "gap-1", padding: "p-1" }
  );

  useEffect(() => {
    const handler = () =>
      setGridConfig(getGridConfig(window.innerWidth, window.innerHeight));
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const pageSize = gridConfig.pageSize;
  const totalPages = Math.ceil(cameras.length / pageSize);

  const visibleCameras = useMemo(
    () => cameras.slice(page * pageSize, (page + 1) * pageSize),
    [cameras, page, pageSize],
  );

  // Clamp page when pageSize changes
  useEffect(() => {
    const maxPage = Math.max(0, totalPages - 1);
    setPage((p) => Math.min(p, maxPage));
  }, [totalPages]);

  // Auto-cycle
  useEffect(() => {
    if (totalPages <= 1 || paused) return;
    const id = setInterval(() => {
      setPage((p) => (p + 1) % totalPages);
    }, cycleInterval);
    return () => clearInterval(id);
  }, [totalPages, cycleInterval, paused]);

  // Show controls on mouse/touch
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Mouse move → show controls
  useEffect(() => {
    document.addEventListener("mousemove", showControls);
    document.addEventListener("touchstart", showControls);
    return () => {
      document.removeEventListener("mousemove", showControls);
      document.removeEventListener("touchstart", showControls);
    };
  }, [showControls]);

  // Keyboard: Space = pause/play, ESC = dashboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        setPaused((p) => !p);
        showControls();
      }
      if (e.key === "Escape") {
        window.location.href = "/dashboard";
      }
      if (e.key === "r" || e.key === "R") {
        window.location.reload();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showControls]);

  if (cameras.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center text-zinc-600">
          <div className="text-5xl mb-4">📷</div>
          <p className="text-sm">Sin cámaras online</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 bg-black grid grid-cols-${gridConfig.cols} ${gridConfig.gap} ${gridConfig.padding}`}>
      {visibleCameras.map((camera) => (
        <div key={`page${page}-${camera.id}`} className="relative">
          <CameraTile
            camera={camera}
            streamType="sub"
            pageKey={page}
          />
        </div>
      ))}

      {/* Empty slots */}
      {Array.from({
        length: Math.max(0, pageSize - visibleCameras.length),
      }).map((_, i) => (
        <div key={`empty-${i}`} className="bg-zinc-950 rounded" />
      ))}

      {/* Controls overlay (bottom-center) */}
      {controlsVisible && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 z-10 transition-opacity duration-300">
          {totalPages > 1 && (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="text-white/70 hover:text-white transition-colors"
              aria-label={paused ? "Reanudar rotación" : "Pausar rotación"}
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
          )}

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i)}
                  className={[
                    "h-1.5 rounded-full transition-all",
                    i === page ? "w-4 bg-white/60" : "w-1.5 bg-white/20",
                  ].join(" ")}
                  aria-label={`Página ${i + 1}`}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <span className="text-white/30 text-[10px] w-10 text-center">
              {paused ? "Pausa" : "Auto"}
            </span>
          )}

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-white/50 hover:text-white transition-colors"
            aria-label="Actualizar cámaras"
            title="Actualizar (R)"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => { window.location.href = "/dashboard"; }}
            className="text-white/50 hover:text-white transition-colors ml-1"
            aria-label="Salir del modo TV"
            title="Salir (ESC)"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
