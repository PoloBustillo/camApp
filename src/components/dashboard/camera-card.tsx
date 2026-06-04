"use client";

import { useDashboardStore } from "@/stores/dashboard.store";
import type { DashboardCamera } from "@/stores/dashboard.store";

interface CameraCardProps {
  camera: DashboardCamera;
  compact?: boolean;
  onSelect?: (id: string) => void;
  selected?: boolean;
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

  if (compact) {
    return (
      <div
        data-testid={testId ?? `camera-card-${camera.id}`}
        onClick={() => onSelect?.(camera.id)}
        className={[
          "relative bg-black aspect-video rounded-lg overflow-hidden flex flex-col items-center justify-center",
          selected ? "ring-2 ring-primary" : "",
          onSelect ? "cursor-pointer" : "",
        ].filter(Boolean).join(" ")}
      >
        {/* Status indicator */}
        <span
          data-testid="status-indicator"
          className={[
            "absolute top-2 right-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium z-10",
            camera.online ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600",
          ].join(" ")}
        >
          <span className={["h-1.5 w-1.5 rounded-full", camera.online ? "bg-green-500 animate-pulse" : "bg-red-400"].join(" ")} />
          {camera.online ? "Online" : "Offline"}
        </span>

        {/* Center content */}
        <span className="text-2xl mb-1">📷</span>
        <p
          data-testid="camera-name"
          className="text-xs text-white font-medium truncate max-w-[90%] text-center"
        >
          {camera.name}
        </p>

        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 flex items-center justify-between px-2 py-1">
          <span
            data-testid="protocol-badge"
            className={["text-xs px-1.5 py-0.5 rounded font-mono uppercase", PROTOCOL_COLORS[camera.protocol] ?? "bg-gray-100 text-gray-600"].join(" ")}
          >
            {camera.protocol}
          </span>
          {camera.online && (
            <button
              type="button"
              onClick={handleFullscreen}
              title="Pantalla completa"
              className="text-xs text-white/70 hover:text-white transition-colors p-0.5 rounded hover:bg-white/10"
              aria-label="Pantalla completa"
            >
              ⛶
            </button>
          )}
        </div>
      </div>
    );
  }

  // Full list/detail mode
  return (
    <div
      data-testid={testId ?? `camera-card-${camera.id}`}
      onClick={() => onSelect?.(camera.id)}
      className={[
        "relative rounded-xl border bg-card text-card-foreground shadow-sm transition-all min-h-[72px]",
        "overflow-hidden",
        selected ? "ring-2 ring-primary border-primary" : "border-border hover:border-muted-foreground",
        onSelect ? "cursor-pointer" : "",
      ].filter(Boolean).join(" ")}
    >
      {/* Left status bar */}
      <div
        className={[
          "absolute left-0 top-0 bottom-0 w-0.5",
          camera.online ? "bg-green-500" : "bg-red-400",
        ].join(" ")}
      />

      <div className="pl-4 pr-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p
              data-testid="camera-name"
              className="font-semibold text-sm text-foreground truncate"
            >
              {camera.name}
            </p>
            <span
              data-testid="status-indicator"
              className={[
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium shrink-0",
                camera.online ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600",
              ].join(" ")}
            >
              <span className={["h-1.5 w-1.5 rounded-full", camera.online ? "bg-green-500 animate-pulse" : "bg-red-400"].join(" ")} />
              {camera.online ? "Online" : "Offline"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{camera.siteName}</p>
          {camera.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{camera.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span
              data-testid="protocol-badge"
              className={["text-xs px-1.5 py-0.5 rounded font-mono uppercase", PROTOCOL_COLORS[camera.protocol] ?? "bg-gray-100 text-gray-600"].join(" ")}
            >
              {camera.protocol}
            </span>
            {!camera.enabled && (
              <span className="text-xs text-muted-foreground">Deshabilitada</span>
            )}
          </div>
        </div>

        {/* Right: fullscreen or chevron */}
        {camera.online ? (
          <button
            type="button"
            onClick={handleFullscreen}
            title="Pantalla completa"
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
            aria-label="Pantalla completa"
          >
            ⛶
          </button>
        ) : (
          <span className="shrink-0 text-muted-foreground text-sm">›</span>
        )}
      </div>
    </div>
  );
}
