"use client";

import { useState, useEffect, useCallback, useRef, Component } from "react";
import { Play, Pause, LogOut, RefreshCw } from "lucide-react";
import { CameraTile } from "./camera-tile";
import type { CameraViewerItem, PersistedFilters, PlayerState } from "@/types/camera-viewer";

const WATCHDOG_THRESHOLD_MS = 60_000;
const MENU_PULSE_INTERVAL_MS = 30_000;
const MENU_AUTO_HIDE_MS = 3_000;
const CYCLE_MS = 15_000;

class KioskErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) {
    console.error("[kiosk] Render error:", error.message);
    setTimeout(() => window.location.reload(), 5000);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-black flex items-center justify-center">
          <div className="text-center text-zinc-500">
            <p className="text-sm mb-4">Error al cargar — recargando...</p>
            <button onClick={() => window.location.reload()} className="text-xs px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white/60 transition-all">Recargar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * KioskGrid — TV mode.
 * 1 camera at a time, full screen, auto-rotates every 15s.
 * Only 1 WebRTC connection active = stable on TV browsers.
 */
export function KioskGrid({
  cameras,
  cycleInterval = CYCLE_MS,
  cameraFilters,
}: {
  cameras: CameraViewerItem[];
  cycleInterval?: number;
  cameraFilters?: Record<string, PersistedFilters>;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraStatesRef = useRef<Map<string, PlayerState>>(new Map());
  const allBadSinceRef = useRef<number | null>(null);

  // Fix index if cameras change
  useEffect(() => {
    if (index >= cameras.length) setIndex(0);
  }, [cameras.length, index]);

  // Auto-cycle
  useEffect(() => {
    if (cameras.length <= 1 || paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % cameras.length);
    }, cycleInterval);
    return () => clearInterval(id);
  }, [cameras.length, cycleInterval, paused]);

  // Show controls
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), MENU_AUTO_HIDE_MS);
  }, []);

  useEffect(() => () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); }, []);

  // Input listeners
  useEffect(() => {
    const handler = () => showControls();
    document.addEventListener("mousemove", handler);
    document.addEventListener("click", handler);
    document.addEventListener("touchstart", handler);
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("mousemove", handler);
      document.removeEventListener("click", handler);
      document.removeEventListener("touchstart", handler);
      document.removeEventListener("keydown", handler);
    };
  }, [showControls]);

  // Menu pulse
  useEffect(() => {
    const id = setInterval(showControls, MENU_PULSE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [showControls]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); setPaused((p) => !p); showControls(); }
      if (e.key === "ArrowLeft") { setPaused(true); setIndex((i) => Math.max(0, i - 1)); showControls(); }
      if (e.key === "ArrowRight") { setPaused(true); setIndex((i) => Math.min(cameras.length - 1, i + 1)); showControls(); }
      if (e.key === "Escape") { window.location.href = "/dashboard"; }
      if (e.key === "r" || e.key === "R") { window.location.reload(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showControls, cameras.length]);

  // Watchdog
  useEffect(() => {
    const id = setInterval(() => {
      const states = cameraStatesRef.current;
      if (states.size === 0) return;
      const allBad = Array.from(states.values()).every((s) => s === "error" || s === "offline");
      if (allBad) {
        if (allBadSinceRef.current === null) allBadSinceRef.current = Date.now();
        else if (Date.now() - allBadSinceRef.current > WATCHDOG_THRESHOLD_MS) {
          window.location.reload();
        }
      } else {
        allBadSinceRef.current = null;
      }
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  const handleStateChange = useCallback((_state: PlayerState) => {
    // Could use for watchdog
  }, []);

  const handleRefresh = useCallback(() => window.location.reload(), []);

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

  const camera = cameras[index];

  return (
    <KioskErrorBoundary>
      <div className="fixed inset-0 bg-black">
        {/* Single camera, full screen */}
        <div key={camera.id} className="absolute inset-0">
          <CameraTile
            camera={camera}
            streamType="sub"
            filters={cameraFilters?.[camera.id]}
            preferWhep
            alwaysShowInfo
            onStateChange={handleStateChange}
          />
        </div>

        {/* Refresh button always visible */}
        <button onClick={handleRefresh} className="fixed top-3 right-3 z-20 p-2 rounded-full bg-black/50 text-white/40 hover:text-white transition-all" aria-label="Recargar">
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Controls overlay */}
        {controlsVisible && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 rounded-full px-4 py-2 z-10">
            <button onClick={() => { setPaused((p) => !p); showControls(); }} className="text-white/70 hover:text-white" aria-label={paused ? "Reanudar" : "Pausar"}>
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>

            <span className="text-white/60 text-xs">{index + 1}/{cameras.length}</span>

            {/* Dot indicators */}
            <div className="flex items-center gap-1">
              {cameras.map((c, i) => (
                <button key={c.id} onClick={() => { setIndex(i); setPaused(true); showControls(); }} className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-white/60" : "w-1.5 bg-white/20"}`} aria-label={c.name} />
              ))}
            </div>

            <button onClick={handleRefresh} className="text-white/50 hover:text-white" aria-label="Recargar"><RefreshCw className="w-4 h-4" /></button>
            <button onClick={() => { window.location.href = "/dashboard"; }} className="text-white/50 hover:text-white ml-1" aria-label="Salir"><LogOut className="w-4 h-4" /></button>
          </div>
        )}
      </div>
    </KioskErrorBoundary>
  );
}