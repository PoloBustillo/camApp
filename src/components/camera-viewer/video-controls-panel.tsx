"use client";

import type { FilterPreset } from "@/hooks/use-video-controls";

interface VideoControlsPanelProps {
  brightness: number;
  contrast: number;
  saturation: number;
  zoom: number;
  preset: FilterPreset;
  onBrightnessChange: (v: number) => void;
  onContrastChange: (v: number) => void;
  onSaturationChange: (v: number) => void;
  onZoomChange: (v: number) => void;
  onPresetChange: (p: FilterPreset) => void;
  onReset: () => void;
  className?: string;
}

const PRESETS: { id: FilterPreset; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "night", label: "Noche" },
  { id: "high-contrast", label: "Contraste" },
  { id: "grayscale", label: "B/N" },
  { id: "vivid", label: "Vívido" },
  { id: "invert", label: "Invertir" },
];

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-300 tabular-nums">{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 accent-white cursor-pointer"
        aria-label={label}
      />
    </div>
  );
}

export function VideoControlsPanel({
  brightness,
  contrast,
  saturation,
  zoom,
  preset,
  onBrightnessChange,
  onContrastChange,
  onSaturationChange,
  onZoomChange,
  onPresetChange,
  onReset,
  className = "",
}: VideoControlsPanelProps) {
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Ajustes de imagen</h3>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-zinc-400 hover:text-white transition-colors"
        >
          Restablecer
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onPresetChange(id)}
            className={[
              "px-2 py-1 rounded text-xs transition-colors",
              preset === id
                ? "bg-white/20 text-white"
                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      <SliderRow
        label="Brillo"
        value={brightness}
        min={50}
        max={200}
        onChange={onBrightnessChange}
      />
      <SliderRow
        label="Contraste"
        value={contrast}
        min={50}
        max={200}
        onChange={onContrastChange}
      />
      <SliderRow
        label="Saturación"
        value={saturation}
        min={0}
        max={200}
        onChange={onSaturationChange}
      />
      <SliderRow
        label="Zoom"
        value={Math.round(zoom * 100)}
        min={100}
        max={500}
        onChange={(v) => onZoomChange(v / 100)}
      />

      <p className="text-[10px] text-zinc-500 leading-relaxed">
        Rueda del ratón o pellizco para zoom. Arrastra con zoom activo para
        mover. Doble clic para restablecer vista.
      </p>
    </div>
  );
}
