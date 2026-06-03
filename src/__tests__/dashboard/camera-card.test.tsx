/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CameraCard } from "@/components/dashboard/camera-card";
import type { DashboardCamera } from "@/stores/dashboard.store";

// Mock the Zustand store
vi.mock("@/stores/dashboard.store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/stores/dashboard.store")>();
  return {
    ...actual,
    useDashboardStore: (selector: (s: { setFullscreen: (id: string) => void }) => unknown) =>
      selector({ setFullscreen: vi.fn() }),
  };
});

const makeCamera = (overrides: Partial<DashboardCamera> = {}): DashboardCamera => ({
  id: "cam-001",
  name: "Entrada Principal",
  description: "Cámara frontal",
  protocol: "rtsp",
  enabled: true,
  online: true,
  siteId: "site-001",
  siteName: "Sede Central",
  ...overrides,
});

describe("CameraCard", () => {
  describe("Online/Offline indicator", () => {
    it("shows Online badge when camera is online", () => {
      render(<CameraCard camera={makeCamera({ online: true })} />);
      expect(screen.getByTestId("status-indicator")).toHaveTextContent("Online");
    });

    it("shows Offline badge when camera is offline", () => {
      render(<CameraCard camera={makeCamera({ online: false })} />);
      expect(screen.getByTestId("status-indicator")).toHaveTextContent("Offline");
    });

    it("shows fullscreen button only when online", () => {
      const { rerender } = render(<CameraCard camera={makeCamera({ online: true })} />);
      expect(screen.getByRole("button", { name: /pantalla completa/i })).toBeInTheDocument();

      rerender(<CameraCard camera={makeCamera({ online: false })} />);
      expect(screen.queryByRole("button", { name: /pantalla completa/i })).not.toBeInTheDocument();
    });
  });

  describe("Protocol badge", () => {
    it.each(["rtsp", "rtmp", "webrtc", "hls"])("renders %s protocol badge", (protocol) => {
      render(<CameraCard camera={makeCamera({ protocol })} />);
      expect(screen.getByTestId("protocol-badge")).toHaveTextContent(protocol);
    });
  });

  describe("Camera name", () => {
    it("renders camera name", () => {
      render(<CameraCard camera={makeCamera({ name: "Cámara Trasera" })} />);
      expect(screen.getByTestId("camera-name")).toHaveTextContent("Cámara Trasera");
    });
  });

  describe("Compact mode", () => {
    it("hides description in compact mode", () => {
      const cam = makeCamera({ description: "Some description" });
      render(<CameraCard camera={cam} compact />);
      expect(screen.queryByText("Some description")).not.toBeInTheDocument();
    });

    it("shows description in full mode", () => {
      const cam = makeCamera({ description: "Visible description" });
      render(<CameraCard camera={cam} compact={false} />);
      expect(screen.getByText("Visible description")).toBeInTheDocument();
    });
  });

  describe("Selection", () => {
    it("calls onSelect with camera id when clicked", () => {
      const onSelect = vi.fn();
      render(<CameraCard camera={makeCamera()} onSelect={onSelect} />);
      fireEvent.click(screen.getByTestId("camera-card-cam-001"));
      expect(onSelect).toHaveBeenCalledWith("cam-001");
    });

    it("does not throw when onSelect is not provided", () => {
      render(<CameraCard camera={makeCamera()} />);
      expect(() =>
        fireEvent.click(screen.getByTestId("camera-card-cam-001"))
      ).not.toThrow();
    });
  });

  describe("data-testid", () => {
    it("uses default testid based on camera id", () => {
      render(<CameraCard camera={makeCamera()} />);
      expect(screen.getByTestId("camera-card-cam-001")).toBeInTheDocument();
    });

    it("uses custom testid when provided", () => {
      render(<CameraCard camera={makeCamera()} data-testid="my-card" />);
      expect(screen.getByTestId("my-card")).toBeInTheDocument();
    });
  });
});
