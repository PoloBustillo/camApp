"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useDashboardStore,
  GRID_LAYOUTS,
  type GridLayout,
  type DashboardCamera,
} from "@/stores/dashboard.store";
import { CameraPlayer } from "./camera-player";
import { CameraCard } from "./camera-card";

// ─── Types ────────────────────────────────────────────────────

interface CameraGridProps {
  cameras: DashboardCamera[];
  /** Polling interval in ms. 0 = disabled. Default: 10000 */
  pollingInterval?: number;
  onRefresh?: () => Promise<DashboardCamera[]>;
}

// ─── Sortable Cell ────────────────────────────────────────────

function SortableCell({
  id,
  index,
  camera,
  isFullscreen,
}: {
  id: string;
  index: number;
  camera: DashboardCamera | undefined;
  isFullscreen: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`grid-cell-${index}`}
      className={[
        "relative rounded-lg overflow-hidden bg-muted/30 border border-border",
        "aspect-video flex items-center justify-center",
        isDragging ? "z-50 shadow-xl" : "",
      ].join(" ")}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 z-10 cursor-grab active:cursor-grabbing p-1 rounded bg-black/20 hover:bg-black/40 transition-colors"
        title="Arrastrar"
        aria-label="Arrastrar celda"
      >
        <span className="text-white/70 text-xs">⠿</span>
      </div>

      {camera ? (
        <div className="w-full h-full">
          {camera.online && !isFullscreen ? (
            <CameraPlayer
              cameraId={camera.id}
              cameraName={camera.name}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full p-2">
              <CameraCard camera={camera} compact />
            </div>
          )}
        </div>
      ) : (
        <EmptyCell index={index} />
      )}
    </div>
  );
}

// ─── Empty cell (camera picker) ───────────────────────────────

function EmptyCell({ index }: { index: number }) {
  const setCellCamera = useDashboardStore((s) => s.setCellCamera);
  const [open, setOpen] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<DashboardCamera[]>([]);

  // Fetch available cameras on open
  async function handleOpen() {
    const res = await fetch("/api/cameras?limit=100").catch(() => null);
    if (res?.ok) {
      const json = await res.json();
      setAvailableCameras(
        (json.data ?? []).map((c: {
          id: string; name: string; description: string | null;
          protocol: string; enabled: boolean; online: boolean;
          siteId: string; site?: { name: string };
        }) => ({ ...c, siteName: c.site?.name ?? "" })),
      );
    }
    setOpen(true);
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-2">
      <button
        type="button"
        onClick={handleOpen}
        className="text-muted-foreground hover:text-foreground text-xs flex flex-col items-center gap-1 transition-colors"
        data-testid={`empty-cell-${index}`}
      >
        <span className="text-2xl">＋</span>
        <span>Añadir cámara</span>
      </button>

      {open && (
        <div className="absolute inset-0 z-20 bg-background/95 rounded-lg p-3 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold">Seleccionar cámara</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
          {availableCameras.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay cámaras disponibles</p>
          ) : (
            <ul className="space-y-1">
              {availableCameras.map((cam) => (
                <li key={cam.id}>
                  <button
                    type="button"
                    onClick={() => { setCellCamera(index, cam.id); setOpen(false); }}
                    className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors flex items-center justify-between"
                  >
                    <span className="truncate">{cam.name}</span>
                    <span className={cam.online ? "text-green-500" : "text-red-400"}>
                      {cam.online ? "●" : "○"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Layout Selector ─────────────────────────────────────────

function LayoutSelector() {
  const { layout, customCols, customRows, setLayout, setCustomDimensions } =
    useDashboardStore();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground">Layout:</span>
      {GRID_LAYOUTS.map((gl) => (
        <button
          key={gl.type}
          type="button"
          onClick={() => setLayout(gl.type)}
          data-testid={`layout-btn-${gl.type}`}
          className={[
            "text-xs px-2.5 py-1 rounded border transition-colors",
            layout === gl.type
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {gl.label}
        </button>
      ))}

      {layout === "custom" && (
        <div className="flex items-center gap-1 text-xs">
          <input
            type="number"
            min={1}
            max={6}
            value={customCols}
            onChange={(e) => setCustomDimensions(Number(e.target.value), customRows)}
            className="w-10 border border-border rounded px-1 py-0.5 text-center"
            aria-label="Columnas"
          />
          <span className="text-muted-foreground">×</span>
          <input
            type="number"
            min={1}
            max={6}
            value={customRows}
            onChange={(e) => setCustomDimensions(customCols, Number(e.target.value))}
            className="w-10 border border-border rounded px-1 py-0.5 text-center"
            aria-label="Filas"
          />
        </div>
      )}
    </div>
  );
}

// ─── Main CameraGrid ──────────────────────────────────────────

export function CameraGrid({
  cameras: initialCameras,
  pollingInterval = 10_000,
  onRefresh,
}: CameraGridProps) {
  const {
    layout,
    customCols,
    customRows,
    cellCameraIds,
    fullscreenCameraId,
    moveCells,
    setFullscreen,
    resetCells,
  } = useDashboardStore();

  const [cameras, setCameras] = useState<DashboardCamera[]>(initialCameras);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Polling for real-time updates ─────────────────────────
  useEffect(() => {
    if (!onRefresh || pollingInterval <= 0) return;

    pollingRef.current = setInterval(async () => {
      const updated = await onRefresh().catch(() => null);
      if (updated) setCameras(updated);
    }, pollingInterval);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [onRefresh, pollingInterval]);

  // ── Grid dimensions ───────────────────────────────────────
  const config = GRID_LAYOUTS.find((l) => l.type === layout)!;
  const cols = layout === "custom" ? customCols : config.cols;
  const totalCells = layout === "custom" ? customCols * customRows : cols * cols;

  // ── Ensure cellCameraIds matches grid size ─────────────────
  useEffect(() => {
    if (cellCameraIds.length !== totalCells) resetCells();
  }, [totalCells, cellCameraIds.length, resetCells]);

  // ── Camera lookup map ─────────────────────────────────────
  const cameraMap = new Map(cameras.map((c) => [c.id, c]));

  // ── dnd-kit sensors ───────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromIndex = cellCameraIds.indexOf(active.id as string | null);
    const toIndex = cellCameraIds.indexOf(over.id as string | null);

    // If dragging by cell index strings
    const fromIdx = Number(active.id);
    const toIdx = Number(over.id);
    if (!isNaN(fromIdx) && !isNaN(toIdx)) {
      moveCells(fromIdx, toIdx);
    }
  }

  // ── Fullscreen overlay ────────────────────────────────────
  const fullscreenCamera = fullscreenCameraId
    ? cameraMap.get(fullscreenCameraId)
    : null;

  // ── Sortable IDs (use cell index as string id) ────────────
  const cellIds = Array.from({ length: totalCells }, (_, i) => String(i));

  const colsClass: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
    6: "grid-cols-6",
  };

  return (
    <div data-testid="camera-grid" className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <LayoutSelector />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{cameras.filter((c) => c.online).length}/{cameras.length} online</span>
          {onRefresh && (
            <button
              type="button"
              onClick={async () => {
                const updated = await onRefresh().catch(() => null);
                if (updated) setCameras(updated);
              }}
              className="px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
            >
              ↻ Actualizar
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={cellIds} strategy={rectSortingStrategy}>
          <div
            className={["grid gap-2", colsClass[cols] ?? "grid-cols-2"].join(" ")}
            data-testid="grid-container"
          >
            {cellIds.map((cellId, index) => {
              const cameraId = cellCameraIds[index];
              const camera = cameraId ? cameraMap.get(cameraId) : undefined;
              return (
                <SortableCell
                  key={cellId}
                  id={cellId}
                  index={index}
                  camera={camera}
                  isFullscreen={!!fullscreenCameraId}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Fullscreen overlay */}
      {fullscreenCamera && (
        <div
          data-testid="fullscreen-overlay"
          className="fixed inset-0 z-50 bg-black flex flex-col"
        >
          <div className="flex items-center justify-between px-4 py-2 bg-black/80">
            <p className="text-white text-sm font-medium">{fullscreenCamera.name}</p>
            <button
              type="button"
              onClick={() => setFullscreen(null)}
              className="text-white/70 hover:text-white text-sm transition-colors"
              aria-label="Cerrar pantalla completa"
            >
              ✕ Cerrar
            </button>
          </div>
          <div className="flex-1 relative">
            <CameraPlayer
              cameraId={fullscreenCamera.id}
              cameraName={fullscreenCamera.name}
              className="w-full h-full"
            />
          </div>
        </div>
      )}

      {/* Camera sidebar — quick status list */}
      {cameras.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            Todas las cámaras ({cameras.length})
          </summary>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {cameras.map((cam) => (
              <CameraCard key={cam.id} camera={cam} compact />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
