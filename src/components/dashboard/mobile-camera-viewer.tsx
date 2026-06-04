"use client";

import { useEffect, useRef, useState } from "react";
import { CameraPlayer } from "./camera-player";
import type { DashboardCamera } from "@/stores/dashboard.store";

interface MobileCameraViewerProps {
  cameras: DashboardCamera[];
  initialIndex: number;
  onClose: () => void;
}

const MAX_DOTS = 8;

export function MobileCameraViewer({
  cameras,
  initialIndex,
  onClose,
}: MobileCameraViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  const total = cameras.length;
  const camera = cameras[currentIndex];

  // Auto-hide controls after 3s
  useEffect(() => {
    if (showControls) {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [showControls, currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        setCurrentIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        setCurrentIndex((i) => Math.min(total - 1, i + 1));
      } else if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [total, onClose]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartXRef.current === null) return;
    const deltaX = (e.changedTouches[0]?.clientX ?? 0) - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(deltaX) > 50) {
      if (deltaX < 0) {
        setCurrentIndex((i) => Math.min(total - 1, i + 1));
      } else {
        setCurrentIndex((i) => Math.max(0, i - 1));
      }
    }
  }

  function handleToggleControls() {
    setShowControls((v) => !v);
  }

  const showDots = total <= MAX_DOTS;

  if (!camera) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top info bar */}
      <div
        className={[
          "flex items-center justify-between px-4 py-2 bg-black/80 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={onClose}
          className="text-white/80 hover:text-white text-sm font-medium"
          aria-label="Cerrar"
        >
          ✕
        </button>
        <p className="text-white text-sm font-medium truncate flex-1 text-center px-2">
          {camera.name}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-white/70 text-xs">
            {currentIndex + 1} / {total}
          </span>
          <span
            className={[
              "h-2 w-2 rounded-full",
              camera.online ? "bg-green-400 animate-pulse" : "bg-red-400",
            ].join(" ")}
          />
        </div>
      </div>

      {/* Camera player */}
      <div className="flex-1 relative" onClick={handleToggleControls}>
        <CameraPlayer
          key={camera.id}
          cameraId={camera.id}
          cameraName={camera.name}
          siteName={camera.siteName}
          protocol={camera.protocol}
          autoPlay
          onBack={onClose}
          compact={false}
          className="w-full h-full rounded-none"
        />
      </div>

      {/* Bottom navigation bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <button
          type="button"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="text-white/80 hover:text-white disabled:opacity-30 text-sm font-medium px-3 py-1"
        >
          ← Ant
        </button>

        {/* Dot indicators */}
        <div className="flex items-center gap-1.5">
          {showDots ? (
            Array.from({ length: total }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                className={[
                  "h-1.5 rounded-full transition-all",
                  i === currentIndex ? "w-3 bg-white" : "w-1.5 bg-white/30",
                ].join(" ")}
                aria-label={`Cámara ${i + 1}`}
              />
            ))
          ) : (
            <span className="text-white/60 text-xs">
              {currentIndex + 1} / {total}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
          disabled={currentIndex === total - 1}
          className="text-white/80 hover:text-white disabled:opacity-30 text-sm font-medium px-3 py-1"
        >
          Sig →
        </button>
      </div>
    </div>
  );
}
