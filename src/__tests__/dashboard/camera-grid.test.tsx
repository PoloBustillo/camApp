/// <reference types="@testing-library/jest-dom" />
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CameraGrid } from "@/components/dashboard/camera-grid";
import type { DashboardCamera } from "@/stores/dashboard.store";

// Mock dnd-kit to avoid jsdom pointer event issues
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  arrayMove: vi.fn(),
  rectSortingStrategy: vi.fn(),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}));

// Mock CameraPlayer to avoid WebRTC complexity
vi.mock("@/components/dashboard/camera-player", () => ({
  CameraPlayer: ({ cameraName }: { cameraName: string }) => (
    <div data-testid="camera-player">{cameraName}</div>
  ),
}));

// Mock Zustand store
const mockStore: {
  layout: import("@/stores/dashboard.store").GridLayout;
  customCols: number;
  customRows: number;
  cellCameraIds: (string | null)[];
  fullscreenCameraId: string | null;
  moveCells: ReturnType<typeof vi.fn>;
  setFullscreen: ReturnType<typeof vi.fn>;
  resetCells: ReturnType<typeof vi.fn>;
  setLayout: ReturnType<typeof vi.fn>;
  setCustomDimensions: ReturnType<typeof vi.fn>;
  setCellCamera: ReturnType<typeof vi.fn>;
} = {
  layout: "2x2",
  customCols: 2,
  customRows: 2,
  cellCameraIds: [null, null, null, null],
  fullscreenCameraId: null,
  moveCells: vi.fn(),
  setFullscreen: vi.fn(),
  resetCells: vi.fn(),
  setLayout: vi.fn(),
  setCustomDimensions: vi.fn(),
  setCellCamera: vi.fn(),
};

vi.mock("@/stores/dashboard.store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/stores/dashboard.store")>();
  return {
    ...actual,
    useDashboardStore: (selector?: (s: typeof mockStore) => unknown) =>
      selector ? selector(mockStore) : mockStore,
  };
});

const makeCam = (n: number, online = true): DashboardCamera => ({
  id: `cam-${n}`,
  name: `Cámara ${n}`,
  description: null,
  protocol: "rtsp",
  enabled: true,
  online,
  siteId: "site-001",
  siteName: "Sede Central",
});

const cameras = [makeCam(1), makeCam(2), makeCam(3, false), makeCam(4)];

describe("CameraGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.cellCameraIds = [null, null, null, null];
    mockStore.fullscreenCameraId = null;
  });

  it("renders the camera-grid container", () => {
    render(<CameraGrid cameras={cameras} />);
    expect(screen.getByTestId("camera-grid")).toBeInTheDocument();
  });

  it("renders the layout selector buttons", () => {
    render(<CameraGrid cameras={cameras} />);
    expect(screen.getByTestId("layout-btn-1x1")).toBeInTheDocument();
    expect(screen.getByTestId("layout-btn-2x2")).toBeInTheDocument();
    expect(screen.getByTestId("layout-btn-3x3")).toBeInTheDocument();
    expect(screen.getByTestId("layout-btn-4x4")).toBeInTheDocument();
    expect(screen.getByTestId("layout-btn-custom")).toBeInTheDocument();
  });

  it("renders 4 cells for 2x2 layout", () => {
    render(<CameraGrid cameras={cameras} />);
    expect(screen.getByTestId("grid-cell-0")).toBeInTheDocument();
    expect(screen.getByTestId("grid-cell-1")).toBeInTheDocument();
    expect(screen.getByTestId("grid-cell-2")).toBeInTheDocument();
    expect(screen.getByTestId("grid-cell-3")).toBeInTheDocument();
  });

  it("renders cameras when assigned to cells", () => {
    mockStore.cellCameraIds = ["cam-1", "cam-2", null, null];
    render(<CameraGrid cameras={cameras} />);
    // Cameras that are online render a player
    expect(screen.getAllByTestId("camera-player")).toHaveLength(2);
  });

  it("renders empty cell buttons for unassigned cells", () => {
    mockStore.cellCameraIds = [null, null, null, null];
    render(<CameraGrid cameras={cameras} />);
    expect(screen.getAllByTestId(/empty-cell-/)).toHaveLength(4);
  });

  it("shows correct online/total count", () => {
    render(<CameraGrid cameras={cameras} />);
    // 3 online out of 4
    expect(screen.getByText("3/4 online")).toBeInTheDocument();
  });

  it("renders 1 cell for 1x1 layout", () => {
    mockStore.layout = "1x1";
    mockStore.cellCameraIds = [null];
    render(<CameraGrid cameras={cameras} />);
    expect(screen.getByTestId("grid-cell-0")).toBeInTheDocument();
    expect(screen.queryByTestId("grid-cell-1")).not.toBeInTheDocument();
  });
});
