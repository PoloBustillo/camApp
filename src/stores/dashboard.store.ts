import { create } from "zustand";
import { persist } from "zustand/middleware";

export type GridLayout = "1x1" | "2x2" | "3x3" | "4x4" | "custom";

export interface GridLayoutConfig {
  type: GridLayout;
  cols: number;
  rows: number;
  label: string;
}

export const GRID_LAYOUTS: GridLayoutConfig[] = [
  { type: "1x1", cols: 1, rows: 1, label: "1×1" },
  { type: "2x2", cols: 2, rows: 2, label: "2×2" },
  { type: "3x3", cols: 3, rows: 3, label: "3×3" },
  { type: "4x4", cols: 4, rows: 4, label: "4×4" },
  { type: "custom", cols: 2, rows: 3, label: "Custom" },
];

export interface DashboardCamera {
  id: string;
  name: string;
  description: string | null;
  protocol: string;
  enabled: boolean;
  online: boolean;
  siteId: string;
  siteName: string;
}

interface DashboardState {
  layout: GridLayout;
  customCols: number;
  customRows: number;
  /** Ordered list of camera IDs assigned to grid cells */
  cellCameraIds: (string | null)[];
  /** Camera currently shown in fullscreen */
  fullscreenCameraId: string | null;

  setLayout: (layout: GridLayout) => void;
  setCustomDimensions: (cols: number, rows: number) => void;
  setCellCamera: (cellIndex: number, cameraId: string | null) => void;
  moveCells: (fromIndex: number, toIndex: number) => void;
  setFullscreen: (cameraId: string | null) => void;
  resetCells: () => void;
}

function buildEmptyCells(cols: number, rows: number): null[] {
  return Array(cols * rows).fill(null);
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      layout: "2x2",
      customCols: 2,
      customRows: 3,
      cellCameraIds: buildEmptyCells(2, 2),
      fullscreenCameraId: null,

      setLayout(layout) {
        const config = GRID_LAYOUTS.find((l) => l.type === layout)!;
        const cols = layout === "custom" ? get().customCols : config.cols;
        const rows = layout === "custom" ? get().customRows : config.rows;
        set({ layout, cellCameraIds: buildEmptyCells(cols, rows) });
      },

      setCustomDimensions(cols, rows) {
        set({ customCols: cols, customRows: rows, cellCameraIds: buildEmptyCells(cols, rows) });
      },

      setCellCamera(cellIndex, cameraId) {
        set((s) => {
          const next = [...s.cellCameraIds];
          next[cellIndex] = cameraId;
          return { cellCameraIds: next };
        });
      },

      moveCells(fromIndex, toIndex) {
        set((s) => {
          const next = [...s.cellCameraIds];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(toIndex, 0, moved);
          return { cellCameraIds: next };
        });
      },

      setFullscreen(cameraId) {
        set({ fullscreenCameraId: cameraId });
      },

      resetCells() {
        const { layout, customCols, customRows } = get();
        const config = GRID_LAYOUTS.find((l) => l.type === layout)!;
        const cols = layout === "custom" ? customCols : config.cols;
        const rows = layout === "custom" ? customRows : config.rows;
        set({ cellCameraIds: buildEmptyCells(cols, rows) });
      },
    }),
    {
      name: "camwatch-dashboard",
      partialize: (s) => ({
        layout: s.layout,
        customCols: s.customCols,
        customRows: s.customRows,
        cellCameraIds: s.cellCameraIds,
      }),
    },
  ),
);
