import type { Meta, StoryObj } from "@storybook/react";
import { CameraCard } from "@/components/dashboard/camera-card";
import type { DashboardCamera } from "@/stores/dashboard.store";

const mockCamera: DashboardCamera = {
  id: "cam-001",
  name: "Entrada Principal",
  description: "Cámara de la entrada",
  protocol: "rtsp",
  enabled: true,
  online: true,
  siteId: "site-001",
  siteName: "Sede Central",
};

const meta: Meta<typeof CameraCard> = {
  title: "Dashboard/CameraCard",
  component: CameraCard,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    camera: mockCamera,
    compact: false,
    selected: false,
  },
};

export default meta;
type Story = StoryObj<typeof CameraCard>;

export const Online: Story = {};

export const Offline: Story = {
  args: {
    camera: { ...mockCamera, online: false },
  },
};

export const Selected: Story = {
  args: { selected: true },
};

export const Compact: Story = {
  args: { compact: true },
};

export const CompactOffline: Story = {
  args: {
    compact: true,
    camera: { ...mockCamera, online: false },
  },
};

export const RTMP: Story = {
  args: {
    camera: { ...mockCamera, protocol: "rtmp" },
  },
};

export const WebRTC: Story = {
  args: {
    camera: { ...mockCamera, protocol: "webrtc" },
  },
};

export const HLS: Story = {
  args: {
    camera: { ...mockCamera, protocol: "hls" },
  },
};
