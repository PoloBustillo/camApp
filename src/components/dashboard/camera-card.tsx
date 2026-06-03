"use client";

import { useDashboardStore } from "@/stores/dashboard.store";
import type { DashboardCamera } from "@/stores/dashboard.store";

interface CameraCardProps {
  camera: DashboardCamera;
  /** If true renders in compact grid mode (no description) */
  compact?: boolean;
  onSelect?: (id: string) => void;
  selected?: boolean;
  /** data-testid for testing */
  "data-testid"?: string;
}

const PROTOCOL_COLORS: Record<string, string> = {
  rtsp: "bg-blue-100 text-blue-700",
  rtmp: "bg-purple-100 text-purple-700",
  webrtc: "bg-green-100 text-green-700",
  hls: "bg-orange-100 text-orange-700",
};

export function CameraCard({
  camera,
  compact = false,
  onSelect,
  selected = false,
  "data-testid": testId,
}: CameraCardProps) {
  const setFullscreen = useDashboardStore((s) => s.setFullscreen);

  function handleFullscreen(e: React.MouseEvent) {
    e.stopPropagation();
    setFullscreen(camera.id);
  }

  return (
    <div
      data-testid={testId ?? `camera-card-${camera.id}`}
      onClick={() => onSelect?.(camera.id)}
      className={[
        "relative rounded-lg border bg-card text-card-foreground shadow-sm transition-all",
        selected ? "ring-2 ring-primary border-primary" : "border-border hover:border-muted-foreground",
        onSelect ? "cursor-pointer" : "",
        compact ? "p-2" : "p-4",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Status indicator */}
      <span
        data-testid="status-indicator"
        className={[
          "absolute top-2 right-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
          camera.online
            ? "bg-green-100 text-green-700"
            : "bg-red-100 text-red-600",
        ].join(" ")}
      >
        <span
          className={[
            "h-1.5 w-1.5 rounded-full",
            camera.online ? "bg-green-500 animate-pulse" : "bg-red-400",
          ].join(" ")}
        />
        {camera.online ? "Online" : "Offline"}
      </span>

      {/* Camera name */}
      <p
        data-testid="camera-name"
        className={[
          "font-medium text-foreground pr-16 truncate",
          compact ? "text-xs" : "text-sm",
        ].join(" ")}
      >
        {camera.name}
      </p>

      {!compact && (
        <>
          {/* Site name */}
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {camera.siteName}
          </p>

          {/* Description */}
          {camera.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {camera.description}
            </p>
          )}
        </>
      )}

      {/* Footer: protocol badge + fullscreen button */}
      <div className="flex items-center justify-between mt-2">
        <span
          data-testid="protocol-badge"
          className={[
            "text-xs px-1.5 py-0.5 rounded font-mono uppercase",
            PROTOCOL_COLORS[camera.protocol] ?? "bg-gray-100 text-gray-600",
          ].join(" ")}
        >
          {camera.protocol}
        </span>

        {!camera.enabled && (
          <span className="text-xs text-muted-foreground">Deshabilitada</span>
        )}

        {camera.online && (
          <button
            type="button"
            onClick={handleFullscreen}
            title="Pantalla completa"
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
            aria-label="Pantalla completa"
          >
            ⛶
          </button>
        )}
      </div>
    </div>
  );
}
