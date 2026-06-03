import type { Meta, StoryObj } from "@storybook/react";
import { CameraPlayer } from "@/components/dashboard/camera-player";

const meta: Meta<typeof CameraPlayer> = {
  title: "Dashboard/CameraPlayer",
  component: CameraPlayer,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    cameraId: "cam-001",
    cameraName: "Entrada Principal",
    autoPlay: false,
  },
  decorators: [
    (Story) => (
      <div className="w-[640px] h-[360px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CameraPlayer>;

/** Idle state — player not started. Click "Iniciar" to begin. */
export const Idle: Story = {
  args: { autoPlay: false },
};

/** Auto-starts playback on mount. Will error if no real MediaMTX endpoint exists. */
export const AutoPlay: Story = {
  args: { autoPlay: true },
};

/** Demonstrates the error state. */
export const ErrorState: Story = {
  args: {
    autoPlay: true,
    cameraId: "non-existent-camera",
    cameraName: "Cámara sin stream",
  },
};
