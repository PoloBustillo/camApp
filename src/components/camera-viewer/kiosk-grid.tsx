"use client";

import { useState, useEffect, useMemo } from "react";
import { CameraTile } from "./camera-tile";
import type { CameraViewerItem } from "@/types/camera-viewer";

interface KioskGridProps {
  cameras: CameraViewerItem[];
  /** Auto-cycle pages every N seconds (default 15) */
  cycleInterval?: number;
  /** Cameras per page (default 4) */
  pageSize?: number;
}

/**
 * KioskGrid — TV/Kiosk mode.
 * - No chrome, no controls, pure video.
 * - Auto-cycles through pages of cameras.
 * - Full viewport, black background.
 * - ESC → redirect to /dashboard.
 */
export function KioskGrid({
  cameras,
  cycleInterval = 15_000,
  pageSize = 4,
}: KioskGridProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(cameras.length / pageSize);

  const visibleCameras = useMemo(
    () => cameras.slice(page * pageSize, (page + 1) * pageSize),
    [cameras, page, pageSize],
  );

  // Auto-cycle
  useEffect(() => {
    if (totalPages <= 1) return;
    const id = setInterval(() => {
      setPage((p) => (p + 1) % totalPages);
    }, cycleInterval);
    return () => clearInterval(id);
  }, [totalPages, cycleInterval]);

  // ESC → dashboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        window.location.href = "/dashboard";
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
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
    <div className="fixed inset-0 bg-black grid grid-cols-2 gap-1 p-1">
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

      {/* Page indicator (bottom-right, minimal) */}
      {totalPages > 1 && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
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
    </div>
  );
}
