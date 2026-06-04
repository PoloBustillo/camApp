"use client";

import { useState, useCallback, useMemo } from "react";
import { useCameraPage } from "@/hooks/use-camera-page";
import { CameraTile } from "./camera-tile";
import { CameraModal } from "./camera-modal";
import { CameraPagination } from "./camera-pagination";
import type { CameraViewerItem } from "@/types/camera-viewer";

interface CameraViewerGridProps {
  cameras: CameraViewerItem[];
  /** Title shown in header */
  title?: string;
}

/**
 * CameraViewerGrid — Professional camera monitoring grid.
 *
 * Architecture:
 * - Max 4 cameras shown simultaneously (2×2 grid)
 * - Pagination: when page changes, React keys change → tiles remount → WebRTC closes
 * - Single camera modal opens with main stream
 * - Dark theme (zinc/black palette) for security monitoring context
 */
export function CameraViewerGrid({ cameras, title }: CameraViewerGridProps) {
  const {
    page,
    totalPages,
    visibleCameras,
    hasNext,
    hasPrev,
    goToPage,
    nextPage,
    prevPage,
  } = useCameraPage(cameras);

  const [selectedCamera, setSelectedCamera] = useState<CameraViewerItem | null>(null);

  const onlineCount = useMemo(() => cameras.filter((c) => c.online).length, [cameras]);

  const handleTileClick = useCallback((cam: CameraViewerItem) => {
    setSelectedCamera(cam);
  }, []);

  const handleModalClose = useCallback(() => {
    setSelectedCamera(null);
  }, []);

  return (
    <div className="bg-zinc-950 rounded-2xl overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          {title && (
            <h2 className="text-white text-sm font-semibold">{title}</h2>
          )}
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-zinc-400 text-xs">
              {onlineCount}/{cameras.length} online
            </span>
          </div>
        </div>
        {totalPages > 1 && (
          <span className="text-zinc-600 text-xs hidden sm:block">
            Página {page} de {totalPages}
          </span>
        )}
      </div>

      {/* Grid area */}
      <div className="p-3">
        {cameras.length === 0 ? (
          <div className="aspect-video flex items-center justify-center">
            <div className="text-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-12 h-12 text-zinc-700 mx-auto mb-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <p className="text-zinc-600 text-sm">Sin cámaras configuradas</p>
              <a href="/cameras" className="text-zinc-500 text-xs hover:text-zinc-400 underline mt-1 block">
                Ir a configuración
              </a>
            </div>
          </div>
        ) : (
          <>
            {/* 2×2 grid — using page as key prefix to force remount on page change */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {visibleCameras.map((camera) => (
                <CameraTile
                  key={`page${page}-${camera.id}`}
                  camera={camera}
                  streamType="sub"
                  onClick={handleTileClick}
                  pageKey={page}
                />
              ))}

              {/* Empty slots to maintain 2×2 grid */}
              {Array.from({ length: Math.max(0, 4 - visibleCameras.length) }).map(
                (_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="aspect-video rounded-xl bg-zinc-900/50 border border-dashed border-zinc-800 flex items-center justify-center"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-8 h-8 text-zinc-800">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                ),
              )}
            </div>

            {/* Pagination */}
            <CameraPagination
              page={page}
              totalPages={totalPages}
              hasNext={hasNext}
              hasPrev={hasPrev}
              onNext={nextPage}
              onPrev={prevPage}
              onPage={goToPage}
              totalCameras={cameras.length}
            />
          </>
        )}
      </div>

      {/* Single camera modal */}
      {selectedCamera && (
        <CameraModal camera={selectedCamera} onClose={handleModalClose} />
      )}
    </div>
  );
}
