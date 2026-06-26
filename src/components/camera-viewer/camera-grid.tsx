"use client";

import React, { Suspense, lazy, useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause } from "lucide-react";
import type { DragEndEvent } from "@dnd-kit/core";
import { useCameraPage } from "@/hooks/use-camera-page";
import { useCameraOrder } from "@/hooks/use-camera-order";
import {
  useGridPreferences,
  getPageSize,
} from "@/hooks/use-grid-preferences";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { CameraTile } from "./camera-tile";
import { CameraModal } from "./camera-modal";
import { CameraPagination } from "./camera-pagination";
import { KeyboardHelp } from "./keyboard-help";
import { GridToolbar } from "./grid-toolbar";
import { isTvBrowser } from "@/lib/device";
import type { CameraViewerItem, PersistedFilters } from "@/types/camera-viewer";

const SortableGrid = lazy(() =>
  import("./sortable-grid").then((m) => ({ default: m.SortableGrid }))
);

interface CameraViewerGridProps {
  cameras: CameraViewerItem[];
  title?: string;
  favoriteIds?: string[];
  /** Camera IDs in display order, fetched server-side */
  cameraOrderIds?: string[];
  /** Per-camera color filter settings, fetched server-side */
  cameraFilters?: Record<string, PersistedFilters>;
  /** Show 2×2 / 3×3 and Todas / Favoritas toggles (home page) */
  showGridControls?: boolean;
}

export function CameraViewerGrid({
  cameras,
  title,
  favoriteIds,
  cameraOrderIds = [],
  cameraFilters: initialCameraFilters,
  showGridControls = false,
}: CameraViewerGridProps) {
  const router = useRouter();
  const { layout, filter, setLayout, setFilter } = useGridPreferences();
  const pageSize = getPageSize(layout);

  // Redirect TV browsers to /tv immediately
  useEffect(() => {
    if (isTvBrowser()) {
      router.replace("/tv");
    }
  }, [router]);

  // Mutable copy of filters — updated when modal saves
  const [cameraFilters, setCameraFilters] = useState(initialCameraFilters);

  const {
    orderedCameras,
    reorder,
    resetOrder,
    hasCustomOrder,
  } = useCameraOrder(cameras, cameraOrderIds);

  const favoriteSet = useMemo(() => new Set(favoriteIds ?? []), [favoriteIds]);

  const displayCameras = useMemo(() => {
    if (!showGridControls || filter === "all") return orderedCameras;
    return orderedCameras.filter(
      (c) => favoriteSet.has(c.id) || c.isFavorite,
    );
  }, [orderedCameras, filter, favoriteSet, showGridControls]);

  const [isEditing, setIsEditing] = useState(false);

  const resetKey = `${layout}-${filter}-${displayCameras.length}-${isEditing}`;

  const {
    page,
    totalPages,
    visibleCameras,
    hasNext,
    hasPrev,
    goToPage,
    nextPage,
    prevPage,
  } = useCameraPage(displayCameras, pageSize, resetKey);

  const [selectedCamera, setSelectedCamera] = useState<CameraViewerItem | null>(
    null,
  );
  const [showHelp, setShowHelp] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  useEffect(() => {
    if (!autoRotate || totalPages <= 1 || selectedCamera || isEditing) return;
    const id = setInterval(() => {
      if (!autoRotateRef.current) return;
      if (page >= totalPages) goToPage(1);
      else nextPage();
    }, 90000);
    return () => clearInterval(id);
  }, [autoRotate, totalPages, selectedCamera, page, nextPage, goToPage, isEditing]);

  const onlineCount = useMemo(
    () => displayCameras.filter((c) => c.online).length,
    [displayCameras],
  );

  const gridCols =
    layout === "3x3"
      ? "grid-cols-2 sm:grid-cols-3"
      : "grid-cols-1 sm:grid-cols-2";

  const handleTileClick = useCallback((cam: CameraViewerItem) => {
    setSelectedCamera(cam);
  }, []);

  const handleModalClose = useCallback(() => {
    setSelectedCamera(null);
  }, []);

  const handleFiltersChange = useCallback((cameraId: string, filters: PersistedFilters) => {
    setCameraFilters((prev) => ({ ...prev, [cameraId]: filters }));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = displayCameras.findIndex((c) => c.id === active.id);
      const newIndex = displayCameras.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const orderedOldIndex = orderedCameras.findIndex((c) => c.id === active.id);
      const orderedNewIndex = orderedCameras.findIndex((c) => c.id === over.id);
      if (orderedOldIndex === -1 || orderedNewIndex === -1) return;

      reorder(orderedOldIndex, orderedNewIndex);
    },
    [displayCameras, orderedCameras, reorder],
  );

  const toggleEdit = useCallback(() => {
    setIsEditing((v) => !v);
  }, []);

  const handleResetOrder = useCallback(() => {
    resetOrder();
    setIsEditing(false);
  }, [resetOrder]);

  useKeyboardShortcuts({
    onAction: (action) => {
      switch (action) {
        case "grid-1x1":
          goToPage(1);
          break;
        case "fullscreen":
          if (typeof document !== "undefined") {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(() => {});
            } else {
              document.exitFullscreen().catch(() => {});
            }
          }
          break;
        case "help":
          setShowHelp((v) => !v);
          break;
        case "escape":
          if (isEditing) setIsEditing(false);
          else if (showHelp) setShowHelp(false);
          else if (typeof document !== "undefined" && document.fullscreenElement)
            document.exitFullscreen().catch(() => {});
          else setSelectedCamera(null);
          break;
      }
    },
    enabled: !selectedCamera || showHelp,
  });

  // Stable IDs for sortable context
  const sortableIds = useMemo(
    () => visibleCameras.map((c) => c.id),
    [visibleCameras],
  );

  return (
    <div className="bg-zinc-950 rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          {title && (
            <h2 className="text-white text-sm font-semibold">{title}</h2>
          )}
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-zinc-400 text-xs">
              {onlineCount}/{displayCameras.length} online
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {showGridControls && (
            <GridToolbar
              layout={layout}
              filter={filter}
              onLayoutChange={setLayout}
              onFilterChange={setFilter}
              isEditing={isEditing}
              onToggleEdit={toggleEdit}
              onResetOrder={handleResetOrder}
              hasCustomOrder={hasCustomOrder}
            />
          )}
          {totalPages > 1 && !isEditing && (
            <>
              <button
                type="button"
                onClick={() => setAutoRotate((v) => !v)}
                className={[
                  "p-1.5 rounded-lg border transition-all",
                  autoRotate
                    ? "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20"
                    : "border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500",
                ].join(" ")}
                aria-label={autoRotate ? "Detener rotación" : "Rotar páginas cada 10s"}
                title={autoRotate ? "Detener rotación" : "Rotar páginas cada 10s"}
              >
                {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <span className="text-zinc-600 text-xs hidden sm:block">
                Página {page} de {totalPages}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="p-3">
        {displayCameras.length === 0 ? (
          <div className="aspect-video flex items-center justify-center">
            <div className="text-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="w-12 h-12 text-zinc-700 mx-auto mb-3"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
              <p className="text-zinc-600 text-sm">
                {filter === "favorites"
                  ? "Sin favoritas — marca cámaras con ⭐"
                  : "Sin cámaras configuradas"}
              </p>
              <a
                href="/cameras"
                className="text-zinc-500 text-xs hover:text-zinc-400 underline mt-1 block"
              >
                Ir a proveedores
              </a>
            </div>
          </div>
        ) : (
          <>
            {isEditing ? (
              <Suspense fallback={
                <div className={`grid ${gridCols} gap-2 sm:gap-3`}>
                  {visibleCameras.map((camera) => (
                    <div key={`skeleton-${camera.id}`} className="aspect-video rounded-xl bg-zinc-900/50 animate-pulse" />
                  ))}
                </div>
              }>
                <SortableGrid
                  cameras={visibleCameras}
                  sortableIds={sortableIds}
                  onDragEnd={handleDragEnd}
                  onTileClick={handleTileClick}
                  cameraFilters={cameraFilters}
                  gridCols={gridCols}
                />
              </Suspense>
            ) : (
              <div className={`grid ${gridCols} gap-2 sm:gap-3`}>
                {visibleCameras.map((camera) => (
                  <CameraTile
                    key={`page${page}-${camera.id}`}
                    camera={camera}
                    streamType="sub"
                    onClick={handleTileClick}
                    filters={cameraFilters?.[camera.id]}
                  />
                ))}

                {Array.from({
                  length: Math.max(0, pageSize - visibleCameras.length),
                }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="aspect-video rounded-xl bg-zinc-900/50 border border-dashed border-zinc-800 flex items-center justify-center"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      className="w-8 h-8 text-zinc-800"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
                      />
                    </svg>
                  </div>
                ))}
              </div>
            )}

            <CameraPagination
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              hasNext={hasNext}
              hasPrev={hasPrev}
              onNext={nextPage}
              onPrev={prevPage}
              onPage={goToPage}
              totalCameras={displayCameras.length}
            />

            <div className="flex items-center justify-center gap-1.5 mt-2 opacity-40 hover:opacity-70 transition-opacity">
              <kbd className="font-mono text-[10px] px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                ?
              </kbd>
              <span className="text-zinc-500 text-[10px]">
                {isEditing ? "Arrastra para reordenar • ESC para salir" : "atajos de teclado"}
              </span>
            </div>
          </>
        )}
      </div>

      {selectedCamera && (
        <CameraModal
          camera={selectedCamera}
          filters={cameraFilters?.[selectedCamera.id]}
          onFiltersChange={handleFiltersChange}
          onClose={handleModalClose}
        />
      )}

      {showHelp && <KeyboardHelp onClose={() => setShowHelp(false)} />}
    </div>
  );
}
