"use client";

import { useCallback, useMemo, useRef, useState } from "react";

export type FilterPreset =
  | "normal"
  | "night"
  | "high-contrast"
  | "grayscale"
  | "vivid"
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
  night: { brightness: 135, contrast: 95, saturation: 85 },
  "high-contrast": { brightness: 105, contrast: 145, saturation: 100 },
  grayscale: { brightness: 100, contrast: 110, saturation: 0 },
  vivid: { brightness: 108, contrast: 108, saturation: 165 },
  invert: { brightness: 100, contrast: 100, saturation: 100 },
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

export function useVideoControls() {
  const [state, setState] = useState<VideoControlState>(DEFAULTS);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

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

  const reset = useCallback(() => setState(DEFAULTS), []);

  const filterStyle = useMemo(() => {
    const parts = [
      `brightness(${state.brightness / 100})`,
      `contrast(${state.contrast / 100})`,
      `saturate(${state.saturation / 100})`,
    ];
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

  return {
    state,
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
  };
}
