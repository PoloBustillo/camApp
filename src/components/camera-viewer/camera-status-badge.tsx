"use client";

import type { PlayerState } from "@/types/camera-viewer";

interface CameraStatusBadgeProps {
  state: PlayerState;
  /** If true renders as overlay (absolute positioned) */
  overlay?: boolean;
}

const STATE_CONFIG: Record<
  PlayerState,
  { label: string; color: string; dot: string; pulse?: boolean }
> = {
  idle:         { label: "Inactiva",     color: "bg-gray-800/80 text-gray-300",     dot: "bg-gray-400" },
  connecting:   { label: "Conectando",   color: "bg-yellow-900/80 text-yellow-300", dot: "bg-yellow-400", pulse: true },
  playing:      { label: "En vivo",      color: "bg-green-900/80 text-green-300",   dot: "bg-green-400",  pulse: true },
  error:        { label: "Error",        color: "bg-red-900/80 text-red-300",       dot: "bg-red-400" },
  offline:      { label: "Desconectada", color: "bg-gray-800/80 text-gray-400",     dot: "bg-gray-500" },
  reconnecting: { label: "Reconectando", color: "bg-orange-900/80 text-orange-300", dot: "bg-orange-400", pulse: true },
};

export function CameraStatusBadge({ state, overlay = false }: CameraStatusBadgeProps) {
  const cfg = STATE_CONFIG[state];
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider",
        cfg.color,
        overlay ? "absolute top-2 right-2 z-10 backdrop-blur-sm" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full flex-shrink-0",
          cfg.dot,
          cfg.pulse ? "animate-pulse" : "",
        ].join(" ")}
      />
      {cfg.label}
    </span>
  );
}
