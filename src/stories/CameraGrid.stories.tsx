import type { Meta, StoryObj } from "@storybook/react";
import { CameraGrid } from "@/components/dashboard/camera-grid";
import type { DashboardCamera } from "@/stores/dashboard.store";

const makeCam = (n: number, online = true): DashboardCamera => ({
  id: `cam-${String(n).padStart(3, "0")}`,
  name: `Cámara ${n}`,
  description: `Descripción de la cámara ${n}`,
  protocol: ["rtsp", "rtmp", "webrtc", "hls"][n % 4],
  enabled: true,
  online,
  siteId: "site-001",
  siteName: "Sede Central",
});

const cameras: DashboardCamera[] = Array.from({ length: 8 }, (_, i) =>
  makeCam(i + 1, i % 3 !== 0)
);

const meta: Meta<typeof CameraGrid> = {
  title: "Dashboard/CameraGrid",
  component: CameraGrid,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    cameras,
    pollingInterval: 0,
  },
  decorators: [
    (Story) => (
      <div className="p-4 bg-background min-h-screen">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CameraGrid>;

export const Default: Story = {};

export const NoCameras: Story = {
  args: { cameras: [] },
};

export const AllOffline: Story = {
  args: {
    cameras: Array.from({ length: 4 }, (_, i) => makeCam(i + 1, false)),
  },
};

export const SingleCamera: Story = {
  args: { cameras: [makeCam(1)] },
};

export const SixteenCameras: Story = {
  args: {
    cameras: Array.from({ length: 16 }, (_, i) => makeCam(i + 1, i % 4 !== 0)),
  },
};
