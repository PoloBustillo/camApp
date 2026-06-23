"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PersistedFilters } from "@/types/camera-viewer";

export type FilterPreset =
  | "normal"
  | "night"
  | "ultra-night"
  | "night-vision"
  | "high-contrast"
  | "grayscale"
  | "vivid"
  | "warm"
  | "cool"
  | "invert";

export interface VideoControlState {
  brightness: number;
  contrast: number;
  saturation: number;
  zoom: number;
  panX: number;
  panY: number;
  preset: FilterPreset;
}

const DEFAULTS: VideoControlState = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  zoom: 1,
  panX: 0,
  panY: 0,
  preset: "normal",
};

const PRESET_VALUES: Record<
  FilterPreset,
  Pick<VideoControlState, "brightness" | "contrast" | "saturation">
> = {
  normal: { brightness: 100, contrast: 100, saturation: 100 },
  night: { brightness: 140, contrast: 110, saturation: 80 },
  "ultra-night": { brightness: 180, contrast: 120, saturation: 60 },
  "night-vision": { brightness: 150, contrast: 100, saturation: 40 },
  "high-contrast": { brightness: 105, contrast: 150, saturation: 100 },
  grayscale: { brightness: 100, contrast: 110, saturation: 0 },
  vivid: { brightness: 108, contrast: 108, saturation: 165 },
  warm: { brightness: 110, contrast: 100, saturation: 120 },
  cool: { brightness: 105, contrast: 105, saturation: 90 },
  invert: { brightness: 100, contrast: 100, saturation: 100 },
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

function getTouchDistance(t1: React.Touch, t2: React.Touch): number {
  const dx = t2.clientX - t1.clientX;
  const dy = t2.clientY - t1.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function toPersisted(s: VideoControlState): PersistedFilters {
  return {
    brightness: s.brightness,
    contrast: s.contrast,
    saturation: s.saturation,
    preset: s.preset,
  };
}

/**
 * Manages video filter/zoom/pan state.
 *
 * When `cameraId` is provided, color filters (brightness, contrast, saturation,
 * preset) are persisted per-camera via the API and restored on mount via
 * `initialFilters`. Zoom and pan are always ephemeral.
 */
export function useVideoControls(
  cameraId?: string,
  initialFilters?: PersistedFilters | null,
  onFiltersChange?: (cameraId: string, filters: PersistedFilters) => void,
) {
  const [hydrated, setHydrated] = useState(false);

  // Initialize state from server-provided filters
  const [state, setState] = useState<VideoControlState>(() => {
    if (!initialFilters) return DEFAULTS;
    return {
      ...DEFAULTS,
      brightness: initialFilters.brightness ?? 100,
      contrast: initialFilters.contrast ?? 100,
      saturation: initialFilters.saturation ?? 100,
      preset: (initialFilters.preset as FilterPreset) ?? "normal",
    };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const pinchRef = useRef({ startDist: 0, startZoom: 1 });
  const cameraIdRef = useRef(cameraId);
  cameraIdRef.current = cameraId;

  // Hydration effect — apply initialFilters if they arrive after mount
  useEffect(() => {
    if (initialFilters) {
      setState((s) => ({
        ...s,
        brightness: initialFilters.brightness ?? s.brightness,
        contrast: initialFilters.contrast ?? s.contrast,
        saturation: initialFilters.saturation ?? s.saturation,
        preset: (initialFilters.preset as FilterPreset) ?? s.preset,
      }));
    }
    setHydrated(true);
  }, [initialFilters]);

  // Persist color filters via API on every change (debounced, only after hydration)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated || !cameraId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const filters = toPersisted(state);
      // Notify parent of filter change
      if (cameraId && onFiltersChange) {
        onFiltersChange(cameraId, filters);
      }
      // Only save if not default
      if (
        filters.brightness === 100 &&
        filters.contrast === 100 &&
        filters.saturation === 100 &&
        filters.preset === "normal"
      ) {
        fetch(`/api/user/camera-filters?cameraId=${cameraId}`, { method: "DELETE" }).catch(() => {});
      } else {
        fetch("/api/user/camera-filters", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cameraId, ...filters }),
        }).catch(() => {});
      }
    }, 500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [cameraId, hydrated, state.brightness, state.contrast, state.saturation, state.preset, onFiltersChange]);

  const setBrightness = useCallback((brightness: number) => {
    setState((s) => ({ ...s, brightness, preset: "normal" }));
  }, []);

  const setContrast = useCallback((contrast: number) => {
    setState((s) => ({ ...s, contrast, preset: "normal" }));
  }, []);

  const setSaturation = useCallback((saturation: number) => {
    setState((s) => ({ ...s, saturation, preset: "normal" }));
  }, []);

  const setZoom = useCallback((zoom: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    setState((s) => ({
      ...s,
      zoom: clamped,
      ...(clamped === 1 ? { panX: 0, panY: 0 } : {}),
    }));
  }, []);

  const applyPreset = useCallback((preset: FilterPreset) => {
    const values = PRESET_VALUES[preset];
    setState((s) => ({
      ...s,
      preset,
      brightness: values.brightness,
      contrast: values.contrast,
      saturation: values.saturation,
    }));
  }, []);

  const reset = useCallback(() => {
    if (cameraIdRef.current) {
      fetch(`/api/user/camera-filters?cameraId=${cameraIdRef.current}`, { method: "DELETE" }).catch(() => {});
    }
    setState(DEFAULTS);
  }, []);

  const filterStyle = useMemo(() => {
    const parts = [
      `brightness(${state.brightness / 100})`,
      `contrast(${state.contrast / 100})`,
      `saturate(${state.saturation / 100})`,
    ];
    if (state.preset === "night-vision") parts.push("hue-rotate(80deg)");
    if (state.preset === "warm") parts.push("sepia(0.2)");
    if (state.preset === "cool") parts.push("hue-rotate(180deg)");
    if (state.preset === "invert") parts.push("invert(1)");
    return parts.join(" ");
  }, [state.brightness, state.contrast, state.saturation, state.preset]);

  const transformStyle = useMemo(
    () =>
      `scale(${state.zoom}) translate(${state.panX}px, ${state.panY}px)`,
    [state.zoom, state.panX, state.panY],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.2 : -0.2;
      setZoom(state.zoom + delta);
    },
    [setZoom, state.zoom],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (state.zoom <= 1) return;
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: state.panX,
        panY: state.panY,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [state.panX, state.panY, state.zoom],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || state.zoom <= 1) return;
      const start = dragStartRef.current;
      const dx = (e.clientX - start.x) / state.zoom;
      const dy = (e.clientY - start.y) / state.zoom;
      setState((s) => ({
        ...s,
        panX: start.panX + dx,
        panY: start.panY + dy,
      }));
    },
    [isDragging, state.zoom],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, []);

  const handleDoubleClick = useCallback(() => {
    setState((s) => ({ ...s, zoom: 1, panX: 0, panY: 0 }));
  }, []);

  // ── Touch handlers for mobile pinch-to-zoom ──────────────────────

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        pinchRef.current = {
          startDist: getTouchDistance(e.touches[0], e.touches[1]),
          startZoom: state.zoom,
        };
      }
    },
    [state.zoom],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const currentDist = getTouchDistance(e.touches[0], e.touches[1]);
        const ratio = currentDist / pinchRef.current.startDist;
        const newZoom = pinchRef.current.startZoom * ratio;
        const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));
        setState((s) => ({
          ...s,
          zoom: clamped,
          ...(clamped === 1 ? { panX: 0, panY: 0 } : {}),
        }));
      }
    },
    [],
  );

  const handleTouchEnd = useCallback(() => {
    pinchRef.current = { startDist: 0, startZoom: state.zoom };
  }, [state.zoom]);

  return {
    state,
    hydrated,
    filterStyle,
    transformStyle,
    isDragging,
    setBrightness,
    setContrast,
    setSaturation,
    setZoom,
    applyPreset,
    reset,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
