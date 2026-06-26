"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Component } from "react";
import { Play, Pause, LogOut, RefreshCw } from "lucide-react";
import { CameraTile } from "./camera-tile";
import type { CameraViewerItem, PersistedFilters, PlayerState } from "@/types/camera-viewer";

interface KioskGridProps {
  cameras: CameraViewerItem[];
  /** Auto-cycle pages every N seconds (default 15) */
  cycleInterval?: number;
  /** Per-camera color filter settings */
  cameraFilters?: Record<string, PersistedFilters>;
}

const PAGE_SIZE = 4; // 2x2 — TV browsers can't handle 9 concurrent WebRTC
const WATCHDOG_THRESHOLD_MS = 60_000;
const MENU_PULSE_INTERVAL_MS = 30_000;
const MENU_AUTO_HIDE_MS = 3_000;

/** Error boundary for TV mode — prevents white screen on JS errors */
class KioskErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[kiosk] Render error:", error.message);
    // Auto-reload after 5s
    setTimeout(() => window.location.reload(), 5000);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-black flex items-center justify-center">
          <div className="text-center text-zinc-500">
            <p className="text-sm mb-4">Error al cargar — recargando...</p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white/60 transition-all"
            >
              Recargar ahora
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * KioskGrid — TV/Kiosk mode.
 *
 * - Starts PAUSED (no auto-rotation until user presses Play).
 * - Auto-cycles through pages when unpaused.
 * - Space bar toggles play/pause.
 * - Controls appear on mouse move, click, or key press, hide after 3s.
 * - Menu pulses every 30s for 3s so it's always reachable on TV remotes.
 * - Watchdog: if ALL cameras are error/offline for 60s → auto-reload.
 * - Always-visible refresh button in top-right corner.
 * - ESC → redirect to /dashboard.
 */
export function KioskGrid({
  cameras,
  cycleInterval = 15_000,
  cameraFilters,
}: KioskGridProps) {
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Watchdog: track state of each visible camera
  const cameraStatesRef = useRef<Map<string, PlayerState>>(new Map());
  const allBadSinceRef = useRef<number | null>(null);

  const totalPages = Math.ceil(cameras.length / PAGE_SIZE);

  const visibleCameras = useMemo(
    () => cameras.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [cameras, page],
  );

  // Reset watchdog when page changes
  useEffect(() => {
    cameraStatesRef.current = new Map();
    allBadSinceRef.current = null;
  }, [page]);

  // Clamp page when total changes
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

  // Show controls on mouse/touch/click
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), MENU_AUTO_HIDE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Input listeners: mousemove, click, touchstart, keydown
  useEffect(() => {
    document.addEventListener("mousemove", showControls);
    document.addEventListener("click", showControls);
    document.addEventListener("touchstart", showControls);
    document.addEventListener("keydown", showControls);
    return () => {
      document.removeEventListener("mousemove", showControls);
      document.removeEventListener("click", showControls);
      document.removeEventListener("touchstart", showControls);
      document.removeEventListener("keydown", showControls);
    };
  }, [showControls]);

  // Menu pulse: every 30s show controls briefly so TV remote users can always interact
  useEffect(() => {
    const id = setInterval(() => {
      showControls();
    }, MENU_PULSE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [showControls]);

  // Keyboard: Space = pause/play, ArrowLeft/ArrowRight = page, ESC = dashboard, R = reload
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        setPaused((p) => !p);
        showControls();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        setPaused(true);
        setPage((p) => {
          if (e.key === "ArrowLeft") return Math.max(0, p - 1);
          return Math.min(totalPages - 1, p + 1);
        });
        showControls();
        return;
      }
      if (e.key === "Escape") {
        window.location.href = "/dashboard";
        return;
      }
      if (e.key === "r" || e.key === "R") {
        window.location.reload();
        return;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showControls, totalPages]);

  // Watchdog: check if all cameras are bad, auto-reload after 60s
  useEffect(() => {
    const id = setInterval(() => {
      const states = cameraStatesRef.current;
      if (states.size === 0) return; // no reports yet

      const allBad = Array.from(states.values()).every(
        (s) => s === "error" || s === "offline",
      );

      if (allBad) {
        if (allBadSinceRef.current === null) {
          allBadSinceRef.current = Date.now();
        } else if (Date.now() - allBadSinceRef.current > WATCHDOG_THRESHOLD_MS) {
          console.warn(`[kiosk] All cameras bad for 60s — auto-reloading page`);
          window.location.reload();
        }
      } else {
        allBadSinceRef.current = null;
      }
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  // Stable callback: (cameraId, state) — no inline arrow per tile
  const handleTileStateChange = useCallback((cameraId: string, state: PlayerState) => {
    cameraStatesRef.current.set(cameraId, state);
  }, []);

  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

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
    <KioskErrorBoundary>
    <div className="fixed inset-0 bg-black grid grid-cols-2 gap-1 p-1">
      {visibleCameras.map((camera) => (
        <div key={camera.id} className="relative">
          <CameraTile
            camera={camera}
            streamType="sub"
            filters={cameraFilters?.[camera.id]}
            preferWhep
            alwaysShowInfo
            onStateChange={(state) => handleTileStateChange(camera.id, state)}
          />
        </div>
      ))}

      {/* Empty slots */}
      {Array.from({
        length: Math.max(0, PAGE_SIZE - visibleCameras.length),
      }).map((_, i) => (
        <div key={`empty-${i}`} className="bg-zinc-950 rounded" />
      ))}

      {/* Always-visible refresh button (top-right corner) */}
      <button
        type="button"
        onClick={handleRefresh}
        className="fixed top-3 right-3 z-20 p-2 rounded-full bg-black/50 text-white/40 hover:text-white hover:bg-black/70 transition-all"
        aria-label="Actualizar cámaras"
        title="Actualizar (R)"
      >
        <RefreshCw className="w-4 h-4" />
      </button>

      {/* Controls overlay (bottom-center) */}
      {controlsVisible && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 z-10 transition-opacity duration-300">
          {totalPages > 1 && (
            <button
              type="button"
              onClick={() => { setPaused((p) => !p); showControls(); }}
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
                  onClick={() => { setPage(i); showControls(); }}
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
            onClick={handleRefresh}
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
    </KioskErrorBoundary>
  );
}
